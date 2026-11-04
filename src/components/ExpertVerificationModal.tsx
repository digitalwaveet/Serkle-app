import { SerkleLoader } from '@/components/ui/SerkleLoader';
﻿import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Award, Clock, CheckCircle, XCircle, Upload, FileText, ChevronRight, ChevronLeft, AlertCircle, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ExpertVerificationModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
}

const CATEGORIES = [
  "Doctor", "Psychologist", "Therapist", "Lawyer", "Teacher/Educator",
  "Financial Professional", "Business Professional", "Career Professional", "Other"
];

const ExpertVerificationModal: React.FC<ExpertVerificationModalProps> = ({ open, onClose, userId }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingRequest, setExistingRequest] = useState<any>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Form State
  const [category, setCategory] = useState("");
  const [legalName, setLegalName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [experience, setExperience] = useState("");
  const [qualification, setQualification] = useState("");
  const [institution, setInstitution] = useState("");
  const [country, setCountry] = useState("");
  const [organization, setOrganization] = useState("");
  const [license, setLicense] = useState("");
  const [bio, setBio] = useState("");
  const [documents, setDocuments] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);
    supabase
      .from("expert_verification_requests" as any)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        const requests = data as any[];
        if (requests && requests.length > 0) {
          const req = requests[0];
          setExistingRequest(req);
          setCategory(req.professional_category || "");
          setLegalName(req.full_legal_name || "");
          setDisplayName(req.public_display_name || "");
          setTitle(req.professional_title || "");
          setEmail(req.email || "");
          setSpecialty(req.specialty || "");
          setExperience(req.years_experience ? req.years_experience.toString() : "");
          setQualification(req.qualification || "");
          setInstitution(req.institution || "");
          setCountry(req.country || "");
          setOrganization(req.professional_organization || "");
          setLicense(req.license_number || "");
          setBio(req.bio || "");
          setDocuments(req.credential_documents || []);
          
          if (["draft", "more_information_required"].includes(req.status)) {
            setStep(1);
          } else {
            setStep(4);
          }
        } else {
          setExistingRequest(null);
          setStep(1);
        }
        setLoading(false);
      });
  }, [open, userId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setUploadingFile(true);
    const fileExt = file.name.split(".").pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { error } = await supabase.storage
      .from("expert_credentials")
      .upload(filePath, file);

    if (error) {
      toast.error("Failed to upload document");
      console.error(error);
    } else {
      setDocuments([...documents, filePath]);
      toast.success("Document uploaded securely");
    }
    setUploadingFile(false);
  };

  const handleRemoveDocument = async (path: string) => {
    const { error } = await supabase.storage
      .from("expert_credentials")
      .remove([path]);
    
    if (error) {
      toast.error("Failed to remove document");
    } else {
      setDocuments(documents.filter(d => d !== path));
    }
  };

  const handleSaveDraft = async () => {
    await submitRequest("draft");
  };

  const handleSubmit = async () => {
    if (!category || !legalName || !title || !email || !specialty) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (documents.length === 0) {
      toast.error("Please upload at least one credential document");
      return;
    }
    await submitRequest("submitted");
  };

  const submitRequest = async (status: string) => {
    setSubmitting(true);
    const payload = {
      user_id: userId,
      status,
      professional_category: category,
      full_legal_name: legalName,
      public_display_name: displayName,
      professional_title: title,
      email: email,
      specialty: specialty,
      years_experience: experience ? parseInt(experience) : null,
      qualification: qualification,
      institution: institution,
      country: country,
      professional_organization: organization,
      license_number: license,
      bio: bio,
      credential_documents: documents
    };

    let error;
    if (existingRequest?.id) {
      const { error: updateError } = await supabase
        .from("expert_verification_requests" as any)
        .update(payload as any)
        .eq("id", existingRequest.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from("expert_verification_requests" as any)
        .insert(payload as any);
      error = insertError;
    }

    if (error) {
      toast.error(`Failed to ${status === "draft" ? "save draft" : "submit application"}`);
      console.error(error);
    } else {
      toast.success(status === "draft" ? "Draft saved" : "Application submitted successfully");
      if (status === "submitted") {
        setExistingRequest({ ...existingRequest, ...payload, status });
        setStep(4);
      }
    }
    setSubmitting(false);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "draft": return <Badge variant="outline">Draft</Badge>;
      case "submitted": return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Submitted</Badge>;
      case "under_review": return <Badge variant="secondary" className="bg-blue-500/10 text-blue-500"><Search className="h-3 w-3 mr-1" />Under Review</Badge>;
      case "more_information_required": return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><AlertCircle className="h-3 w-3 mr-1" />More Info Needed</Badge>;
      case "verified": return <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Verified</Badge>;
      case "rejected": return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      case "suspended": return <Badge variant="destructive">Suspended</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Expert Verification
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12"><SerkleLoader size="md" className="text-muted-foreground" /></div>
        ) : step === 4 && existingRequest ? (
          <div className="space-y-6">
            <div className="p-6 rounded-xl bg-muted/30 border text-center space-y-4">
              <div className="flex justify-center mb-2">
                {statusBadge(existingRequest.status)}
              </div>
              <h3 className="text-lg font-semibold">Application Status</h3>
              
              {existingRequest.status === "submitted" && <p className="text-sm text-muted-foreground">Your application has been received and is in the queue for review.</p>}
              {existingRequest.status === "under_review" && <p className="text-sm text-muted-foreground">Our team is currently reviewing your credentials.</p>}
              {existingRequest.status === "verified" && <p className="text-sm text-green-600 font-medium">Congratulations! You are a verified expert on Serkle.</p>}
              
              {existingRequest.admin_notes && (
                <div className="mt-4 p-4 bg-background rounded border text-left">
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Admin Notes</p>
                  <p className="text-sm">{existingRequest.admin_notes}</p>
                </div>
              )}

              {["draft", "more_information_required"].includes(existingRequest.status) && (
                <Button onClick={() => setStep(1)} className="mt-4">Update Application</Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between px-2 mb-6 text-sm font-medium">
              {[1, 2, 3].map((s) => (
                <div key={s} className={`flex items-center ${step === s ? "text-primary" : "text-muted-foreground"}`}>
                  <div className={`size-6 rounded-full flex items-center justify-center text-xs mr-2 ${step === s ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {s}
                  </div>
                  {s === 1 ? "Category" : s === 2 ? "Details" : "Credentials"}
                </div>
              ))}
            </div>

            {step === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                <h3 className="text-lg font-semibold">What is your profession?</h3>
                <div className="grid grid-cols-2 gap-3">
                  {CATEGORIES.map(cat => (
                    <Button
                      key={cat}
                      variant={category === cat ? "default" : "outline"}
                      className="justify-start"
                      onClick={() => setCategory(cat)}
                    >
                      {cat}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                <h3 className="text-lg font-semibold">Professional Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Full Legal Name *</label>
                    <Input value={legalName} onChange={e => setLegalName(e.target.value)} placeholder="Jane Doe" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Public Display Name</label>
                    <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Dr. Jane" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Contact Email *</label>
                    <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" type="email" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Professional Title *</label>
                    <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Clinical Psychologist" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Specialty *</label>
                    <Input value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="e.g. Child Therapy" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Years of Experience</label>
                    <Input value={experience} onChange={e => setExperience(e.target.value)} type="number" placeholder="10" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Qualification/Degree</label>
                    <Input value={qualification} onChange={e => setQualification(e.target.value)} placeholder="e.g. Psy.D." />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Institution/University</label>
                    <Input value={institution} onChange={e => setInstitution(e.target.value)} placeholder="e.g. Stanford University" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">License / Cert. Number</label>
                    <Input value={license} onChange={e => setLicense(e.target.value)} placeholder="License #" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Country of Practice</label>
                    <Input value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. USA" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Professional Bio</label>
                  <Textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Brief summary of your professional background..." rows={3} />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                <h3 className="text-lg font-semibold">Upload Credentials</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Please upload documents verifying your identity and qualifications (e.g., medical license, degree, ID). 
                  <strong> These are stored securely and never displayed publicly.</strong>
                </p>
                
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition-colors">
                  <Input type="file" onChange={handleFileUpload} className="hidden" id="credential-upload" disabled={uploadingFile} />
                  <label htmlFor="credential-upload" className="cursor-pointer flex flex-col items-center">
                    {uploadingFile ? (
                      <SerkleLoader size="md" className="text-muted-foreground mb-2" />
                    ) : (
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    )}
                    <span className="text-sm font-medium">Click to upload document</span>
                    <span className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG (Max 5MB)</span>
                  </label>
                </div>

                {documents.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h4 className="text-sm font-medium">Uploaded Documents</h4>
                    {documents.map((doc, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded border text-sm">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="truncate max-w-[200px]">{doc.split("/").pop()}</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveDocument(doc)} className="h-6 px-2 text-destructive">
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t mt-8">
              {step > 1 ? (
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
              ) : (
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleSaveDraft} disabled={submitting}>
                  Save Draft
                </Button>
                
                {step < 3 ? (
                  <Button onClick={() => setStep(step + 1)}>
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button onClick={handleSubmit} disabled={submitting}>
                    {submitting && <SerkleLoader size="xs" className="text-current mr-2" />}
                    Submit Application
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ExpertVerificationModal;

