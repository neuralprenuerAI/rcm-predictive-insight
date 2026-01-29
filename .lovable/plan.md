

# Plan: Add AWS Textract OCR Provider

## Overview
Add AWS Textract as a third OCR provider to the existing `ocr-document` edge function. This will provide enterprise-grade document text extraction alongside the existing OCR.space (free tier) and Azure Document Intelligence options.

## Current State
- **Existing providers**: OCR.space and Azure Document Intelligence
- **Current secrets**: `OCR_SPACE_API_KEY`, `GEMINI_API_KEY`, `LOVABLE_API_KEY`
- **Missing secrets**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`

---

## Implementation Steps

### Step 1: Add AWS Secrets
Add the three required AWS secrets to the edge function configuration:

| Secret Name | Value |
|-------------|-------|
| `AWS_ACCESS_KEY_ID` | `AKIAQDCUK2X7BQ4NIBVI` |
| `AWS_SECRET_ACCESS_KEY` | `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` |
| `AWS_REGION` | `us-east-1` |

### Step 2: Update `ocr-document/index.ts`
Add AWS Textract provider implementation:

1. **Import AWS Signature V4 library** for signing requests:
   ```typescript
   import { AWSSignerV4 } from "https://deno.land/x/aws_sign_v4@1.0.2/mod.ts";
   ```

2. **Add new `ocrWithTextract` function** that:
   - Takes base64 document content
   - Signs the request using AWS Signature V4
   - Calls Textract `DetectDocumentText` API
   - For multi-page PDFs, uses async `StartDocumentTextDetection` with polling
   - Parses response blocks (LINE, WORD) to extract text
   - Returns standardized `OCRResult` format

3. **Update provider selection logic**:
   ```
   Priority order:
   1. Explicit provider parameter ("aws", "azure", "ocr_space")
   2. AWS Textract (if AWS credentials configured)
   3. Azure (if Azure credentials configured)
   4. OCR.space (fallback)
   ```

---

## Technical Details

### AWS Textract API Integration

```text
+------------------+     +-------------------+     +------------------+
|  Edge Function   | --> |  AWS Signature V4 | --> |  Textract API    |
|  (Deno)          |     |  (Request Signing)|     |  (us-east-1)     |
+------------------+     +-------------------+     +------------------+
         |                                                   |
         |<--------------- JSON Response -------------------+
         |
         v
+------------------+
|  Parse Blocks    |
|  - LINE blocks   |
|  - Confidence    |
+------------------+
```

### Textract API Endpoints
- **Sync (single page)**: `DetectDocumentText` - immediate response
- **Async (multi-page PDF)**: `StartDocumentTextDetection` + polling `GetDocumentTextDetection`

### Response Parsing
Textract returns blocks with types:
- `PAGE` - page container
- `LINE` - line of text (primary extraction target)
- `WORD` - individual words with confidence scores

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/ocr-document/index.ts` | Add `ocrWithTextract()` function, update provider selection |

## New Secrets Required

| Secret | Purpose |
|--------|---------|
| `AWS_ACCESS_KEY_ID` | AWS IAM access key |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret key |
| `AWS_REGION` | AWS region (us-east-1) |

---

## Provider Comparison After Implementation

| Provider | Cost | Speed | Accuracy | Best For |
|----------|------|-------|----------|----------|
| OCR.space | Free (25k/mo) | Fast | Good | Development/testing |
| AWS Textract | Pay per page | Fast | Excellent | Production documents |
| Azure Doc Intelligence | Pay per page | Medium | Excellent | Complex forms |

---

## Security Recommendations

1. **Rotate credentials after setup** - The AWS keys were shared in plain text
2. **Create dedicated IAM user** with only `textract:DetectDocumentText` and `textract:StartDocumentTextDetection` permissions
3. **Enable CloudTrail logging** for audit trail

---

## Testing Plan
After implementation:
1. Test with single-page image (JPG/PNG)
2. Test with single-page PDF
3. Test with multi-page PDF (async flow)
4. Verify fallback to OCR.space when AWS not configured
5. Verify provider parameter override works

