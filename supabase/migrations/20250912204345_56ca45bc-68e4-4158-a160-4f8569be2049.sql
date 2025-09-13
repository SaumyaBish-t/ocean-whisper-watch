-- Add coordinates and urgency fields to hazard_reports table
ALTER TABLE public.hazard_reports 
ADD COLUMN latitude DOUBLE PRECISION,
ADD COLUMN longitude DOUBLE PRECISION,
ADD COLUMN urgency TEXT DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high'));

-- Add index for better performance on location-based queries
CREATE INDEX idx_hazard_reports_coordinates ON public.hazard_reports (latitude, longitude);

-- Enable realtime for the hazard_reports table
ALTER TABLE public.hazard_reports REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hazard_reports;