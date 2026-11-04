import { SerkleLoader } from '@/components/ui/SerkleLoader';
﻿import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAudit } from "@/hooks/useAdminAudit";
import { toast } from "sonner";
import { Award, Search, CheckCircle, XCircle, Clock, RefreshCw, Mail, User, Calendar, Briefcase, Eye, FileText, Download, AlertCircle, Ban } from "lucide-react";

interface VerificationRequest {
  id: string;
  user_id: string;
  email: string;
  specialty: string;
  bio: string | null;
  years_experience: number | null;
  status: string;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  professional_category: string | null;
  full_legal_name: string | null;
  public_display_name: string | null;
  professional_title: string | null;
  qualification: string | null;
  institution: string | null;
  country: string | null;
  professional_organization: string | null;
  license_number: string | null;
  credential_documents: string[] | null;
  profile?: {
    name: string;
    username: string;
    avatar_url: string | null;
    initials: string;
    avatar_color: string;
  };
}

export default function AdminExpertVerification() {
  const { logAction } = useAdminAudit();
  const [tab, setTab] = useState("submitted");
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("expert_verification_requests" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const reqs = (data as any[]) || [];
    
    const userIds = [...new Set(reqs.map((r: any) => r.user_id))];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, username, avatar_url, initials, avatar_color")
        .in("id", userIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      reqs.forEach((r: any) => {
        r.profile = profileMap.get(r.user_id);
      });
    }

    setRequests(reqs);
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAction = async (requestId: string, action: "verified" | "rejected" | "more_information_required" | "suspended" | "under_review") => {
    setProcessing(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from("expert_verification_requests" as any)
      .update({
        status: action,
        admin_notes: adminNotes || null,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      } as any)
      .eq("id", requestId);

    if (error) {
      toast.error("Failed to update request");
      console.error(error);
      setProcessing(false);
      return;
    }

    logAction("expert_verification", action, requestId, { action, notes: adminNotes });
    toast.success(`Request marked as ${action.replace(/_/g, " ")}`);
    setSelectedRequest(null);
    setAdminNotes("");
    setProcessing(false);
    fetchRequests();
  };

  const handleDownloadDocument = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("expert_credentials")
      .download(path);
      
    if (error) {
      toast.error("Failed to download document");
      console.error(error);
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = path.split("/").pop() || "document";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filtered = requests.filter(r => {
    const matchesTab = r.status === tab || (tab === "active" && ["submitted", "under_review", "more_information_required"].includes(r.status));
    const matchesSearch = !search || 
      r.email.toLowerCase().includes(search.toLowerCase()) ||
      r.full_legal_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.specialty.toLowerCase().includes(search.toLowerCase()) ||
      r.profile?.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.profile?.username?.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const counts = {
    active: requests.filter(r => ["submitted", "under_review", "more_information_required"].includes(r.status)).length,
    verified: requests.filter(r => r.status === "verified").length,
    rejected: requests.filter(r => r.status === "rejected").length,
    suspended: requests.filter(r => r.status === "suspended").length,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "submitted": return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1"/>Submitted</Badge>;
      case "under_review": return <Badge className="bg-blue-500 hover:bg-blue-600"><Search className="h-3 w-3 mr-1"/>Reviewing</Badge>;
      case "more_information_required": return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><AlertCircle className="h-3 w-3 mr-1"/>Needs Info</Badge>;
      case "verified": return <Badge className="bg-green-600 hover:bg-green-700"><CheckCircle className="h-3 w-3 mr-1"/>Verified</Badge>;
      case "rejected": return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1"/>Rejected</Badge>;
      case "suspended": return <Badge variant="destructive" className="bg-red-800"><Ban className="h-3 w-3 mr-1"/>Suspended</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Award className="h-6 w-6 text-primary" />
            Expert Verification
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Review professional credentials and manage expert statuses
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRequests}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <Clock className="h-5 w-5 text-yellow-500 mx-auto mb-1" />
            <div className="text-2xl font-bold">{counts.active}</div>
            <div className="text-xs text-muted-foreground">Active Queue</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <CheckCircle className="h-5 w-5 text-green-500 mx-auto mb-1" />
            <div className="text-2xl font-bold">{counts.verified}</div>
            <div className="text-xs text-muted-foreground">Verified</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <XCircle className="h-5 w-5 text-destructive mx-auto mb-1" />
            <div className="text-2xl font-bold">{counts.rejected}</div>
            <div className="text-xs text-muted-foreground">Rejected</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <Ban className="h-5 w-5 text-red-800 mx-auto mb-1" />
            <div className="text-2xl font-bold">{counts.suspended}</div>
            <div className="text-xs text-muted-foreground">Suspended</div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by legal name, email, or specialty..."
          className="pl-9"
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="active">Active Queue ({counts.active})</TabsTrigger>
          <TabsTrigger value="verified">Verified ({counts.verified})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
          <TabsTrigger value="suspended">Suspended ({counts.suspended})</TabsTrigger>
        </TabsList>

        {["active", "verified", "rejected", "suspended"].map(statusGroup => (
          <TabsContent key={statusGroup} value={statusGroup}>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <SerkleLoader size="sm" className="text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No requests found in this category
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filtered.map(req => (
                  <Card key={req.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12">
                          {req.profile?.avatar_url && <AvatarImage src={req.profile.avatar_url} />}
                          <AvatarFallback style={{ backgroundColor: req.profile?.avatar_color }}>
                            {req.profile?.initials || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground text-lg">{req.full_legal_name || req.profile?.name}</span>
                              {getStatusBadge(req.status)}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => { setSelectedRequest(req); setAdminNotes(req.admin_notes || ""); }}
                            >
                              <Eye className="h-4 w-4 mr-1" /> Inspect
                            </Button>
                          </div>
                          
                          <div className="text-sm font-medium text-primary mb-2">
                            {req.professional_title} • {req.professional_category}
                          </div>
                          
                          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground mb-2">
                            <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{req.email}</span>
                            <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{req.specialty}</span>
                            {req.institution && (
                              <span className="flex items-center gap-1"><Award className="h-3 w-3" />{req.institution}</span>
                            )}
                          </div>
                          
                          <div className="text-xs text-muted-foreground mt-2 pt-2 border-t flex justify-between">
                            <span>Submitted {new Date(req.created_at).toLocaleDateString()}</span>
                            {req.credential_documents && req.credential_documents.length > 0 && (
                              <span className="flex items-center gap-1 text-primary">
                                <FileText className="h-3 w-3" /> {req.credential_documents.length} document(s)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Award className="h-6 w-6 text-primary" />
              Expert Application Review
            </DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    {selectedRequest.profile?.avatar_url && <AvatarImage src={selectedRequest.profile.avatar_url} />}
                    <AvatarFallback style={{ backgroundColor: selectedRequest.profile?.avatar_color }}>
                      {selectedRequest.profile?.initials || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-foreground text-lg">{selectedRequest.full_legal_name || selectedRequest.profile?.name}</p>
                    <p className="text-sm text-muted-foreground">Account: @{selectedRequest.profile?.username}</p>
                  </div>
                </div>
                {getStatusBadge(selectedRequest.status)}
              </div>

              <div>
                <h4 className="text-sm font-semibold uppercase text-muted-foreground mb-3 border-b pb-1">Professional Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Category</p>
                    <p className="font-medium">{selectedRequest.professional_category || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Professional Title</p>
                    <p className="font-medium">{selectedRequest.professional_title || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Display Name</p>
                    <p className="font-medium">{selectedRequest.public_display_name || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Contact Email</p>
                    <p className="font-medium">{selectedRequest.email}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Specialty</p>
                    <p className="font-medium">{selectedRequest.specialty}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Years of Experience</p>
                    <p className="font-medium">{selectedRequest.years_experience || "N/A"}</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold uppercase text-muted-foreground mb-3 border-b pb-1">Qualifications & Licenses</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Qualification/Degree</p>
                    <p className="font-medium">{selectedRequest.qualification || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Institution</p>
                    <p className="font-medium">{selectedRequest.institution || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">License Number</p>
                    <p className="font-medium">{selectedRequest.license_number || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Professional Organization</p>
                    <p className="font-medium">{selectedRequest.professional_organization || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Country</p>
                    <p className="font-medium">{selectedRequest.country || "N/A"}</p>
                  </div>
                </div>
              </div>

              {selectedRequest.bio && (
                <div>
                  <h4 className="text-sm font-semibold uppercase text-muted-foreground mb-2 border-b pb-1">Professional Bio</h4>
                  <p className="text-sm p-3 bg-muted/30 rounded-lg">{selectedRequest.bio}</p>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold uppercase text-muted-foreground mb-3 border-b pb-1 flex justify-between items-center">
                  <span>Credential Documents</span>
                  <Badge variant="secondary">{selectedRequest.credential_documents?.length || 0} Files</Badge>
                </h4>
                {selectedRequest.credential_documents && selectedRequest.credential_documents.length > 0 ? (
                  <div className="space-y-2">
                    {selectedRequest.credential_documents.map((doc, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-primary" />
                          <span className="text-sm font-medium">{doc.split("/").pop()}</span>
                        </div>
                        <Button variant="secondary" size="sm" onClick={() => handleDownloadDocument(doc)}>
                          <Download className="h-4 w-4 mr-1" /> View / Download
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground p-4 text-center bg-muted/10 rounded border border-dashed">No documents uploaded.</p>
                )}
              </div>

              <div className="bg-muted/30 p-4 rounded-lg border">
                <label className="text-sm font-semibold text-foreground mb-2 block">Internal Admin Notes</label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Leave internal notes for other admins or feedback for the user..."
                  rows={3}
                  className="bg-background"
                />
                <p className="text-xs text-muted-foreground mt-2">Notes will be visible to the user if you request more information or reject the application.</p>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2 mt-6 sm:justify-between border-t pt-4">
                {selectedRequest.status === "submitted" && (
                  <Button variant="outline" onClick={() => handleAction(selectedRequest.id, "under_review")} disabled={processing}>
                    Mark as Reviewing
                  </Button>
                )}
                
                <div className="flex flex-wrap justify-end gap-2 w-full">
                  {selectedRequest.status !== "verified" && (
                    <Button
                      variant="outline"
                      className="border-green-600 text-green-600 hover:bg-green-50"
                      onClick={() => handleAction(selectedRequest.id, "verified")}
                      disabled={processing}
                    >
                      {processing ? <SerkleLoader size="xs" className="text-current mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                      Verify Expert
                    </Button>
                  )}
                  
                  {["submitted", "under_review", "verified", "suspended"].includes(selectedRequest.status) && (
                    <Button
                      variant="outline"
                      className="border-yellow-600 text-yellow-600 hover:bg-yellow-50"
                      onClick={() => {
                        if (!adminNotes) return toast.error("Please add notes explaining what info is needed");
                        handleAction(selectedRequest.id, "more_information_required");
                      }}
                      disabled={processing}
                    >
                      {processing ? <SerkleLoader size="xs" className="text-current mr-1" /> : <AlertCircle className="h-4 w-4 mr-1" />}
                      Request Info
                    </Button>
                  )}

                  {["submitted", "under_review", "more_information_required"].includes(selectedRequest.status) && (
                    <Button
                      variant="outline"
                      className="border-red-600 text-red-600 hover:bg-red-50"
                      onClick={() => handleAction(selectedRequest.id, "rejected")}
                      disabled={processing}
                    >
                      {processing ? <SerkleLoader size="xs" className="text-current mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
                      Reject
                    </Button>
                  )}

                  {selectedRequest.status === "verified" && (
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (!adminNotes) return toast.error("Please add notes explaining the suspension");
                        handleAction(selectedRequest.id, "suspended");
                      }}
                      disabled={processing}
                    >
                      {processing ? <SerkleLoader size="xs" className="text-current mr-1" /> : <Ban className="h-4 w-4 mr-1" />}
                      Suspend Verified Status
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

