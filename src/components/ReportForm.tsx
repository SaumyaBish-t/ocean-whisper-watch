import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Upload, MapPin, Phone, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface ReportFormProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CurrentLocation {
  latitude: number;
  longitude: number;
}

const ReportForm = ({ isOpen, onClose }: ReportFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation | null>(null);
  
  const [formData, setFormData] = useState({
    hazardType: "",
    description: "",
    location: "",
    contactNumber: ""
  });
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setFormData({
      hazardType: "",
      description: "",
      location: "",
      contactNumber: ""
    });
    setImageFile(null);
    setImagePreview("");
    setCurrentLocation(null);
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to submit a report.",
        variant: "destructive"
      });
      return;
    }

    if (!formData.hazardType || !formData.description || !formData.location) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let imageUrl = null;

      // Upload image if selected
      if (imageFile) {
        const fileName = `${Date.now()}-${imageFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('report-images')
          .upload(fileName, imageFile);

        if (uploadError) {
          throw new Error(`Image upload failed: ${uploadError.message}`);
        }

        // Get the public URL
        const { data: { publicUrl } } = supabase.storage
          .from('report-images')
          .getPublicUrl(fileName);
        
        imageUrl = publicUrl;
      }

      // Calculate credibility score
      const { data: credibilityScore } = await supabase.rpc('calculate_credibility_score', {
        has_image: !!imageFile,
        has_location: !!(currentLocation?.latitude && currentLocation?.longitude),
        description_length: formData.description.length,
        nearby_reports_count: 0 // Simplified for now
      });

      // Insert the report into the database
      const { error: insertError } = await supabase
        .from('hazard_reports')
        .insert({
          user_id: user.id,
          hazard_type: formData.hazardType as "Coastal Flooding" | "High Waves" | "Storm Surge" | "Erosion" | "Tsunami Warning" | "Strong Winds" | "Other",
          description: formData.description,
          location: formData.location,
          contact_number: formData.contactNumber || null,
          latitude: currentLocation?.latitude || null,
          longitude: currentLocation?.longitude || null,
          image_url: imageUrl,
          credibility_score: credibilityScore || 0.5
        });

      if (insertError) {
        throw new Error(`Failed to save report: ${insertError.message}`);
      }

      toast({
        title: "Report Submitted Successfully!",
        description: "Thank you for your report. Authorities have been notified.",
      });
      
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error submitting report:', error);
      toast({
        title: "Submission Failed",
        description: error instanceof Error ? error.message : "An error occurred while submitting your report.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation({ latitude, longitude });
          setFormData(prev => ({
            ...prev,
            location: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
          }));
        },
        () => {
          toast({
            title: "Location Access Denied",
            description: "Please enable location access or enter your location manually.",
            variant: "destructive"
          });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    } else {
      toast({
        title: "Geolocation Not Supported",
        description: "Your browser doesn't support geolocation. Please enter your location manually.",
        variant: "destructive"
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-depth">
        <CardHeader className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute right-4 top-4"
          >
            <X className="h-5 w-5" />
          </Button>
          <CardTitle className="text-xl">Report Coastal Hazard</CardTitle>
          <CardDescription>
            Help protect your community by reporting coastal hazards in your area
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Hazard Type */}
            <div className="space-y-2">
              <Label htmlFor="hazardType">Hazard Type *</Label>
              <Select
                value={formData.hazardType}
                onValueChange={(value) => setFormData(prev => ({ ...prev, hazardType: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select hazard type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Coastal Flooding">Coastal Flooding</SelectItem>
                  <SelectItem value="High Waves">High Waves</SelectItem>
                  <SelectItem value="Storm Surge">Storm Surge</SelectItem>
                  <SelectItem value="Erosion">Erosion</SelectItem>
                  <SelectItem value="Tsunami Warning">Tsunami Warning</SelectItem>
                  <SelectItem value="Strong Winds">Strong Winds</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe the hazard situation in detail..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
              />
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              <div className="flex gap-2">
                <Input
                  id="location"
                  placeholder="Enter location or use GPS"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  className="flex-1"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={getCurrentLocation}
                  className="shrink-0"
                >
                  <MapPin className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Contact Number */}
            <div className="space-y-2">
              <Label htmlFor="contactNumber">Contact Number (Optional)</Label>
              <Input
                id="contactNumber"
                type="tel"
                placeholder="Your contact number"
                value={formData.contactNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, contactNumber: e.target.value }))}
              />
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Photo Evidence (Optional)</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                {imagePreview ? (
                  <div className="space-y-4">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-w-full h-48 mx-auto object-cover rounded-lg"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview("");
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                    >
                      Remove Image
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Camera className="h-12 w-12 mx-auto text-muted-foreground" />
                    <div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Photo
                      </Button>
                      <p className="text-sm text-muted-foreground mt-2">
                        Help authorities by providing visual evidence
                      </p>
                    </div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit Report"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportForm;