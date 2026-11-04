import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSellerVerification } from "@/hooks/useSellerVerification";
import { Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { CustomFilePicker, useFileManager } from "@/components/CustomFilePicker";

interface SellerVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStatus?: string;
}

export const SellerVerificationModal = ({
  open,
  onOpenChange,
  currentStatus,
}: SellerVerificationModalProps) => {
  const { submitVerification } = useSellerVerification();
  const [sellerType, setSellerType] = useState<"personal" | "business">("personal");
  const [businessName, setBusinessName] = useState("");
  const [businessRegistration, setBusinessRegistration] = useState("");
  const [taxId, setTaxId] = useState("");
  const [description, setDescription] = useState("");
  const licenseManager = useFileManager();
  const licenseFile = licenseManager.files[0]?.file as File || null;

  const handleSubmit = async () => {
    await submitVerification.mutateAsync({
      sellerType,
      businessName: sellerType === "business" ? businessName : undefined,
      businessRegistrationNumber: sellerType === "business" ? businessRegistration : undefined,
      taxId: sellerType === "business" ? taxId : undefined,
      description,
      licenseFile,
    });
    onOpenChange(false);
  };

  const isSubmitting = submitVerification.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {currentStatus === "verified" ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                Verified Seller
              </>
            ) : currentStatus === "pending" ? (
              <>
                <AlertCircle className="w-5 h-5 text-yellow-500" />
                Verification Pending
              </>
            ) : (
              "Apply for Seller Verification"
            )}
          </DialogTitle>
        </DialogHeader>

        {currentStatus === "verified" ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-semibold text-foreground mb-2">
              Your account is verified!
            </p>
            <p className="text-muted-foreground">
              You have all the benefits of a verified seller
            </p>
          </div>
        ) : currentStatus === "pending" ? (
          <div className="py-6 text-center">
            <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <p className="text-lg font-semibold text-foreground mb-2">
              Verification Under Review
            </p>
            <p className="text-muted-foreground">
              We're reviewing your application. This usually takes 1-3 business days.
            </p>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Seller Type</Label>
              <RadioGroup value={sellerType} onValueChange={(v) => setSellerType(v as any)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="personal" id="personal" />
                  <Label htmlFor="personal">Personal Seller</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="business" id="business" />
                  <Label htmlFor="business">Business</Label>
                </div>
              </RadioGroup>
            </div>

            {sellerType === "business" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name *</Label>
                  <Input
                    id="businessName"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Enter your business name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessRegistration">Business Registration Number *</Label>
                  <Input
                    id="businessRegistration"
                    value={businessRegistration}
                    onChange={(e) => setBusinessRegistration(e.target.value)}
                    placeholder="Enter registration number"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="taxId">Tax ID</Label>
                  <Input
                    id="taxId"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    placeholder="Enter tax identification number"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">Why do you want to be verified? *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell us about your business and why verification is important to you..."
                rows={4}
              />
            </div>

            {sellerType === "business" && (
              <div className="space-y-2">
                <Label htmlFor="license">Business License (Optional)</Label>
                <div className="flex items-center gap-2">
                  <CustomFilePicker
                    manager={licenseManager}
                    accept=".pdf,.jpg,.jpeg,.png,image/*"
                    hideUploadButton
                  >
                    <Button
                      variant="outline"
                      type="button"
                      className="w-full justify-between font-normal"
                    >
                      <span className="truncate">
                        {licenseFile ? licenseFile.name : "Select license file..."}
                      </span>
                      <Upload className="w-5 h-5 text-muted-foreground ml-2" />
                    </Button>
                  </CustomFilePicker>
                </div>
                <p className="text-xs text-muted-foreground">
                  Upload your business license (PDF, JPG, or PNG)
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !description}
                className="flex-1"
              >
                {isSubmitting && <SerkleLoader size="xs" className="text-current mr-2" />}
                Submit Application
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
