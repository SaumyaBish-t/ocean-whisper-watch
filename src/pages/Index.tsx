import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { RoleGuard } from "@/components/RoleGuard";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import ReportForm from "@/components/ReportForm";
import MapDashboard from "@/components/MapDashboard";

const Index = () => {
  const { user, loading } = useAuth();
  const [isReportFormOpen, setIsReportFormOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ocean-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header 
        onReportClick={() => setIsReportFormOpen(true)}
        onDashboardClick={() => setIsDashboardOpen(true)}
      />
      
      <main>
        <HeroSection 
          onReportClick={() => setIsReportFormOpen(true)}
          onDashboardClick={() => setIsDashboardOpen(true)}
        />
      </main>

      {/* Modals */}
      <ReportForm 
        isOpen={isReportFormOpen} 
        onClose={() => setIsReportFormOpen(false)} 
      />
      <RoleGuard requiredRole="authority">
        <MapDashboard 
          isOpen={isDashboardOpen} 
          onClose={() => setIsDashboardOpen(false)} 
        />
      </RoleGuard>
    </div>
  );
};

export default Index;
