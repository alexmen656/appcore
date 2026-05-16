-- CreateIndex
CREATE INDEX "ASOSuggestion_appBundleId_status_idx" ON "ASOSuggestion"("appBundleId", "status");

-- CreateIndex
CREATE INDEX "ASOSuggestion_appBundleId_createdAt_idx" ON "ASOSuggestion"("appBundleId", "createdAt");
