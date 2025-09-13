import { Button } from "@/components/ui/button";
import { Waves, Users, Shield, AlertTriangle, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import logoIcon from "@/assets/logo-icon.png";

interface HeaderProps {
  onReportClick: () => void;
  onDashboardClick: () => void;
}

const Header = ({ onReportClick, onDashboardClick }: HeaderProps) => {
  const { user, signOut } = useAuth();
  return (
    <header className="bg-card/80 backdrop-blur-md border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoIcon} alt="Sagar-SENSE" className="h-10 w-10" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Sagar-SENSE</h1>
              <p className="text-xs text-muted-foreground">Smart Coastal Guardian</p>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Citizen Reports</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span>Official Dashboard</span>
            </div>
          </nav>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {user?.email}
            </span>
            <Button 
              variant="coastal" 
              size="sm"
              onClick={onReportClick}
              className="hidden sm:flex"
            >
              <AlertTriangle className="h-4 w-4" />
              Report Hazard
            </Button>
            <Button 
              variant="ocean" 
              size="sm"
              onClick={onDashboardClick}
            >
              <Waves className="h-4 w-4" />
              Dashboard
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={signOut}
              className="text-foreground hover:text-ocean-600"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;