import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, MapPin, Clock, AlertTriangle, Users, Filter } from "lucide-react";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

// Add custom CSS for pulsing markers
const pulseStyle = `
  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: .5;
    }
  }
  .custom-popup .leaflet-popup-content-wrapper {
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = pulseStyle;
  document.head.appendChild(style);
}

interface MapDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

type HazardReport = Tables<"hazard_reports"> & {
  coordinates?: [number, number];
};

const MapDashboard = ({ isOpen, onClose }: MapDashboardProps) => {
  const [filter, setFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("24h");
  const [credibilityFilter, setCredibilityFilter] = useState("all");
  const [reports, setReports] = useState<HazardReport[]>([]);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<(L.Marker | L.CircleMarker)[]>([]);

  // Fetch reports from Supabase
  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from('hazard_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching reports:', error);
        return;
      }

      // Map database data to component format
      const mappedReports: HazardReport[] = data.map(report => ({
        ...report,
        coordinates: report.latitude && report.longitude 
          ? [report.latitude, report.longitude] as [number, number]
          : undefined
      }));

      setReports(mappedReports);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter reports based on selected filters
  const filteredReports = reports.filter(report => {
    // Urgency filter
    if (filter !== "all" && report.urgency !== filter) return false;
    
    // Credibility filter
    if (credibilityFilter !== "all") {
      const score = report.credibility_score || 0.5;
      if (credibilityFilter === "high" && score < 0.7) return false;
      if (credibilityFilter === "medium" && (score < 0.4 || score >= 0.7)) return false;
      if (credibilityFilter === "low" && score >= 0.4) return false;
    }
    
    return true;
  });

  // Format timestamp for display
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

    if (diffInHours > 24) {
      return `${Math.floor(diffInHours / 24)} days ago`;
    } else if (diffInHours > 0) {
      return `${diffInHours} hours ago`;
    } else if (diffInMinutes > 0) {
      return `${diffInMinutes} minutes ago`;
    } else {
      return "Just now";
    }
  };

  const getCredibilityColor = (credibilityScore: number) => {
    if (credibilityScore >= 0.7) return "#059669"; // Green - High credibility
    if (credibilityScore >= 0.4) return "#ea580c"; // Orange - Medium credibility  
    return "#dc2626"; // Red - Low credibility
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "high": return "destructive";
      case "medium": return "warning";
      case "low": return "secondary";
      default: return "secondary";
    }
  };

  const getMarkerColor = (urgency: string, credibilityScore?: number) => {
    // Prioritize credibility score if available, otherwise fall back to urgency
    if (credibilityScore !== undefined) {
      return getCredibilityColor(credibilityScore);
    }
    
    switch (urgency) {
      case "high": return "#dc2626"; // red
      case "medium": return "#ea580c"; // orange
      case "low": return "#059669"; // green
      default: return "#6b7280"; // gray
    }
  };

  // Set up real-time subscription
  useEffect(() => {
    if (!isOpen) return;

    // Initial fetch
    fetchReports();

    // Set up real-time subscription
    const channel = supabase
      .channel('hazard-reports-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'hazard_reports'
        },
        (payload) => {
          console.log('New report added:', payload.new);
          const newReport = payload.new as Tables<"hazard_reports">;
          const mappedReport: HazardReport = {
            ...newReport,
            coordinates: newReport.latitude && newReport.longitude 
              ? [newReport.latitude, newReport.longitude] as [number, number]
              : undefined
          };
          setReports(prevReports => [mappedReport, ...prevReports]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'hazard_reports'
        },
        (payload) => {
          console.log('Report updated:', payload.new);
          const updatedReport = payload.new as Tables<"hazard_reports">;
          const mappedReport: HazardReport = {
            ...updatedReport,
            coordinates: updatedReport.latitude && updatedReport.longitude 
              ? [updatedReport.latitude, updatedReport.longitude] as [number, number]
              : undefined
          };
          setReports(prevReports => 
            prevReports.map(report => 
              report.id === updatedReport.id ? mappedReport : report
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen]);

  // Map initialization and marker updates
  useEffect(() => {
    if (!isOpen || !mapRef.current) return;

    // Initialize map
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView([20.5937, 78.9629], 5);

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(mapInstanceRef.current);
    }

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add markers for filtered reports that have coordinates
    filteredReports.forEach((report) => {
      if (mapInstanceRef.current && report.coordinates) {
        const urgency = report.urgency || 'medium';
        const credibilityScore = report.credibility_score || 0.5;
        const color = getMarkerColor(urgency, credibilityScore);
        
        // Create pulsing marker for high urgency reports or high credibility
        const shouldPulse = urgency === 'high' || credibilityScore >= 0.8;
        
        const marker = L.circleMarker([report.coordinates[0], report.coordinates[1]], {
          color: color,
          fillColor: color,
          fillOpacity: 0.8,
          radius: credibilityScore >= 0.7 ? 15 : credibilityScore >= 0.4 ? 12 : 10,
          weight: 3,
          className: shouldPulse ? 'animate-pulse' : '',
        }).addTo(mapInstanceRef.current);

        // Enhanced popup with credibility score
        marker.bindPopup(`
          <div class="p-3 min-w-[200px]">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-3 h-3 rounded-full" style="background-color: ${color}"></div>
              <h3 class="font-semibold text-sm">${report.hazard_type}</h3>
            </div>
            <p class="text-xs text-gray-600 mb-2 flex items-center gap-1">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
              ${report.location}
            </p>
            <p class="text-xs mb-2 text-gray-700">${report.description}</p>
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs px-2 py-1 rounded-full text-white" style="background-color: ${color}">
                ${urgency.toUpperCase()}
              </span>
              <span class="text-xs text-gray-500">${formatTimestamp(report.created_at)}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-600">Credibility Score:</span>
              <span class="text-xs font-medium" style="color: ${color}">
                ${Math.round(credibilityScore * 100)}%
              </span>
            </div>
          </div>
        `, {
          maxWidth: 300,
          className: 'custom-popup'
        });

        markersRef.current.push(marker);
      }
    });

    // Add demo markers if no real data exists
    if (filteredReports.length === 0 && mapInstanceRef.current) {
      const demoMarkers = [
        { lat: 19.0176, lng: 72.8562, type: "Coastal Flooding", urgency: "high", location: "Marine Drive, Mumbai" },
        { lat: 8.4004, lng: 76.9784, type: "High Waves", urgency: "medium", location: "Kovalam Beach, Kerala" },
        { lat: 21.6244, lng: 87.5281, type: "Erosion", urgency: "low", location: "Digha Beach, West Bengal" },
      ];

      demoMarkers.forEach((demo) => {
        const color = getMarkerColor(demo.urgency, 0.6); // Demo credibility score
        const marker = L.circleMarker([demo.lat, demo.lng], {
          color: color,
          fillColor: color,
          fillOpacity: 0.7,
          radius: demo.urgency === 'high' ? 15 : demo.urgency === 'medium' ? 12 : 10,
          weight: 3,
          className: demo.urgency === 'high' ? 'animate-pulse' : '',
        }).addTo(mapInstanceRef.current!);

        marker.bindPopup(`
          <div class="p-3 min-w-[200px]">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-3 h-3 rounded-full" style="background-color: ${color}"></div>
              <h3 class="font-semibold text-sm">${demo.type}</h3>
            </div>
            <p class="text-xs text-gray-600 mb-2">${demo.location}</p>
            <p class="text-xs text-orange-600 font-medium mb-2">Demo Data - No real reports yet</p>
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs px-2 py-1 rounded-full text-white" style="background-color: ${color}">
                ${demo.urgency.toUpperCase()}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-600">Credibility Score:</span>
              <span class="text-xs font-medium" style="color: ${color}">60%</span>
            </div>
          </div>
        `);

        markersRef.current.push(marker);
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen, filteredReports]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-7xl max-h-[90vh] overflow-hidden shadow-depth relative">
        <CardHeader className="relative border-b">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute right-4 top-4 z-[60] hover:bg-muted/80 bg-background/95 border border-border/50 shadow-md backdrop-blur-sm"
          >
            <X className="h-5 w-5" />
          </Button>
          <CardTitle className="flex items-center gap-2 text-xl">
            <MapPin className="h-5 w-5 text-primary" />
            Coastal Hazard Dashboard
          </CardTitle>
          <CardDescription>
            Real-time monitoring of coastal hazard reports across Indian coastline
          </CardDescription>
          
          {/* Filters */}
            <div className="flex flex-wrap gap-4 pt-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reports</SelectItem>
                  <SelectItem value="high">High Priority</SelectItem>
                  <SelectItem value="medium">Medium Priority</SelectItem>
                  <SelectItem value="low">Low Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Last Hour</SelectItem>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last Week</SelectItem>
                  <SelectItem value="30d">Last Month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Credibility:</span>
              <Select value={credibilityFilter} onValueChange={setCredibilityFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="high">High (70%+)</SelectItem>
                  <SelectItem value="medium">Medium (40-70%)</SelectItem>
                  <SelectItem value="low">Low (Under 40%)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-4 ml-auto">
              <Badge variant="outline" className="gap-1">
                <Users className="h-3 w-3" />
                {filteredReports.length} Active Reports
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="grid grid-cols-1 lg:grid-cols-4 h-[600px]">
            {/* Interactive Map */}
            <div className="lg:col-span-3 border-r">
              <div 
                ref={mapRef} 
                className="w-full h-full min-h-[600px]"
                style={{ background: '#f8fafc' }}
              />
            </div>

            {/* Reports List & Alerts Panel */}
            <div className="overflow-y-auto">
              <div className="p-4 border-b bg-muted/20">
                <h3 className="font-semibold text-sm">Recent Reports</h3>
              </div>
              
              <div className="space-y-1">
                {loading ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Loading reports...
                  </div>
                ) : filteredReports.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    No reports found
                  </div>
                ) : (
                  filteredReports.map((report) => (
                    <div
                      key={report.id}
                      className="p-4 border-b hover:bg-muted/20 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={`h-4 w-4 ${
                            report.urgency === 'high' ? 'text-destructive' :
                            report.urgency === 'medium' ? 'text-warning' : 'text-muted-foreground'
                          }`} />
                          <span className="font-medium text-sm">{report.hazard_type}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Badge 
                            variant={getUrgencyColor(report.urgency || 'medium') as "destructive" | "secondary"}
                            className="text-xs"
                          >
                            {report.urgency || 'medium'}
                          </Badge>
                          <Badge 
                            variant="outline" 
                            className="text-xs"
                            style={{ 
                              color: getCredibilityColor(report.credibility_score || 0.5),
                              borderColor: getCredibilityColor(report.credibility_score || 0.5)
                            }}
                          >
                            {Math.round((report.credibility_score || 0.5) * 100)}%
                          </Badge>
                        </div>
                      </div>
                      
                      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {report.location}
                      </p>
                      
                      <p className="text-sm text-foreground/80 mb-2 line-clamp-2">
                        {report.description}
                      </p>
                      
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(report.created_at)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MapDashboard;