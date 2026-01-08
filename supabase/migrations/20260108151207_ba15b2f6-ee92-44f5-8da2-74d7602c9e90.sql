-- Fix search_path for increment_template_usage function
CREATE OR REPLACE FUNCTION increment_template_usage(template_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE appeal_templates 
  SET times_used = COALESCE(times_used, 0) + 1 
  WHERE id = template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;