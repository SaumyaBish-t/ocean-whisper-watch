import { Button } from "@/components/ui/button";
import { AlertTriangle, MapPin, Users, Shield } from "lucide-react";
import heroImage from "@/assets/hero-coast.jpg";

interface HeroSectionProps {
  onReportClick: () => void;
  onDashboardClick: () => void;
}

const HeroSection = ({ onReportClick, onDashboardClick }: HeroSectionProps) => {
  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-primary/80 via-primary/60 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-20">
        <div className="max-w-4xl">
          <div className="mb-6">
            <h1 className="text-5xl md:text-7xl font-bold text-primary-foreground mb-6 leading-tight">
              Sagar-SENSE
            </h1>
            <p className="text-xl md:text-2xl text-primary-foreground/90 mb-4 font-medium">
              Smart Coastal Guardian
            </p>
            <p className="text-lg text-primary-foreground/80 max-w-3xl leading-relaxed">
              Transforming citizens into sensors and social media into intelligence. 
              Real-time coastal hazard monitoring for disaster management officials 
              across India's coastline.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-12">
            <Button 
              variant="hero" 
              size="xl"
              onClick={onReportClick}
              className="shadow-depth"
            >
              <AlertTriangle className="h-5 w-5" />
              Report Coastal Hazard
            </Button>
            <Button 
              variant="coastal" 
              size="xl"
              onClick={onDashboardClick}
            >
              <Shield className="h-5 w-5" />
              Official Dashboard
            </Button>
          </div>

          {/* Key Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card/10 backdrop-blur-sm rounded-lg p-6 border border-primary-foreground/20">
              <Users className="h-8 w-8 text-primary-foreground mb-3" />
              <h3 className="text-lg font-semibold text-primary-foreground mb-2">Citizen Reports</h3>
              <p className="text-primary-foreground/80 text-sm">
                Easy reporting via web forms and WhatsApp with automatic location detection
              </p>
            </div>
            <div className="bg-card/10 backdrop-blur-sm rounded-lg p-6 border border-primary-foreground/20">
              <MapPin className="h-8 w-8 text-primary-foreground mb-3" />
              <h3 className="text-lg font-semibold text-primary-foreground mb-2">Live Mapping</h3>
              <p className="text-primary-foreground/80 text-sm">
                Real-time visualization of hazard reports with intelligent clustering
              </p>
            </div>
            <div className="bg-card/10 backdrop-blur-sm rounded-lg p-6 border border-primary-foreground/20">
              <Shield className="h-8 w-8 text-primary-foreground mb-3" />
              <h3 className="text-lg font-semibold text-primary-foreground mb-2">Smart Analysis</h3>
              <p className="text-primary-foreground/80 text-sm">
                AI-powered urgency detection and hotspot identification for officials
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;