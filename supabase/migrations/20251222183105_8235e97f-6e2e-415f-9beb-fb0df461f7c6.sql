-- Fix security definer views by recreating with security_invoker = true
DROP VIEW IF EXISTS public.payer_denial_patterns;
DROP VIEW IF EXISTS public.cpt_denial_patterns;

-- Recreate with security invoker
CREATE VIEW public.payer_denial_patterns 
WITH (security_invoker = true)
AS
SELECT 
  payer,
  COUNT(*) as total_claims,
  COUNT(*) FILTER (WHERE outcome = 'paid') as paid_count,
  COUNT(*) FILTER (WHERE outcome = 'denied') as denied_count,
  COUNT(*) FILTER (WHERE outcome = 'partial') as partial_count,
  ROUND(
    COUNT(*) FILTER (WHERE outcome = 'denied')::DECIMAL / 
    NULLIF(COUNT(*), 0) * 100, 2
  ) as denial_rate,
  ROUND(AVG(predicted_risk_score), 2) as avg_predicted_risk,
  ROUND(
    COUNT(*) FILTER (WHERE was_prediction_correct)::DECIMAL / 
    NULLIF(COUNT(*) FILTER (WHERE was_prediction_correct IS NOT NULL), 0) * 100, 2
  ) as prediction_accuracy,
  MODE() WITHIN GROUP (ORDER BY denial_category) as most_common_denial_reason
FROM public.denial_outcomes
WHERE payer IS NOT NULL
GROUP BY payer
ORDER BY total_claims DESC;

CREATE VIEW public.cpt_denial_patterns 
WITH (security_invoker = true)
AS
SELECT 
  unnest(procedure_codes) as cpt_code,
  COUNT(*) as total_claims,
  COUNT(*) FILTER (WHERE outcome = 'denied') as denied_count,
  ROUND(
    COUNT(*) FILTER (WHERE outcome = 'denied')::DECIMAL / 
    NULLIF(COUNT(*), 0) * 100, 2
  ) as denial_rate,
  MODE() WITHIN GROUP (ORDER BY denial_category) as most_common_denial_reason,
  MODE() WITHIN GROUP (ORDER BY payer) as highest_denial_payer
FROM public.denial_outcomes
WHERE procedure_codes IS NOT NULL
GROUP BY unnest(procedure_codes)
HAVING COUNT(*) >= 3
ORDER BY denial_rate DESC;