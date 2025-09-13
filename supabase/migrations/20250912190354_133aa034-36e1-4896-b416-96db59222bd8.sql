-- Create enum for hazard types
CREATE TYPE public.hazard_type AS ENUM (
  'Coastal Flooding',
  'High Waves', 
  'Storm Surge',
  'Erosion',
  'Tsunami Warning',
  'Strong Winds',
  'Other'
);

-- Create enum for report status
CREATE TYPE public.report_status AS ENUM (
  'submitted',
  'under_review', 
  'resolved',
  'dismissed'
);

-- Create hazard_reports table
CREATE TABLE public.hazard_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  hazard_type hazard_type NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  contact_number TEXT,
  image_url TEXT,
  status report_status NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.hazard_reports ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own reports" 
ON public.hazard_reports 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reports" 
ON public.hazard_reports 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reports" 
ON public.hazard_reports 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reports" 
ON public.hazard_reports 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_hazard_reports_updated_at
  BEFORE UPDATE ON public.hazard_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for report images
INSERT INTO storage.buckets (id, name, public) VALUES ('report-images', 'report-images', false);

-- Create storage policies for report images
CREATE POLICY "Users can view their own report images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'report-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own report images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'report-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own report images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'report-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own report images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'report-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create indexes for better performance
CREATE INDEX idx_hazard_reports_user_id ON public.hazard_reports(user_id);
CREATE INDEX idx_hazard_reports_status ON public.hazard_reports(status);
CREATE INDEX idx_hazard_reports_created_at ON public.hazard_reports(created_at DESC);