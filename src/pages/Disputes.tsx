import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useState } from "react";
import Header from "@/components/Header";
import FooterNav from "@/components/FooterNav";
import { useDisputes } from "@/hooks/useDisputes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const Disputes = () => {
  const { disputes, isLoading, updateDispute } = useDisputes();
  const [selectedDispute, setSelectedDispute] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");

  const handleResolve = async (disputeId: string) => {
    await updateDispute.mutateAsync({
      disputeId,
      status: 'resolved',
      resolution,
    });
    setSelectedDispute(null);
    setResolution("");
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <AlertTriangle className="w-4 h-4" />;
      case 'in_progress':
        return <Clock className="w-4 h-4" />;
      case 'resolved':
        return <CheckCircle2 className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'in_progress':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'resolved':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      default:
        return '';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <SerkleLoader size="md" className="text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {!disputes || disputes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <CheckCircle2 className="w-20 h-20 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold text-foreground mb-2">
              No Disputes
            </h2>
            <p className="text-muted-foreground text-center max-w-md">
              You don't have any active disputes
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {disputes.map((dispute: any) => (
              <Card key={dispute.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2">
                        Order #{dispute.order_id.slice(0, 8)}
                      </CardTitle>
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={dispute.seller.avatar_url} />
                          <AvatarFallback>
                            {dispute.seller.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-muted-foreground">
                          {dispute.seller.name}
                        </span>
                      </div>
                    </div>
                    <Badge className={getStatusColor(dispute.status)}>
                      {getStatusIcon(dispute.status)}
                      <span className="ml-1 capitalize">{dispute.status.replace('_', ' ')}</span>
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-1">Reason:</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {dispute.reason.replace('_', ' ')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-1">Description:</p>
                    <p className="text-sm text-muted-foreground">{dispute.description}</p>
                  </div>

                  {dispute.resolution && (
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-1">Resolution:</p>
                      <p className="text-sm text-muted-foreground">{dispute.resolution}</p>
                    </div>
                  )}

                  {dispute.status !== 'resolved' && (
                    <>
                      {selectedDispute === dispute.id ? (
                        <div className="space-y-3 pt-2">
                          <Textarea
                            value={resolution}
                            onChange={(e) => setResolution(e.target.value)}
                            placeholder="Enter resolution details..."
                            rows={3}
                          />
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSelectedDispute(null);
                                setResolution("");
                              }}
                              className="flex-1"
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={() => handleResolve(dispute.id)}
                              disabled={!resolution || updateDispute.isPending}
                              className="flex-1"
                            >
                              {updateDispute.isPending && (
                                <SerkleLoader size="xs" className="text-current mr-2" />
                              )}
                              Resolve
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={() => setSelectedDispute(dispute.id)}
                          className="w-full"
                        >
                          Resolve Dispute
                        </Button>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <FooterNav active="shop" onSelect={() => {}} onOpenCreate={() => {}} />
    </div>
  );
};

export default Disputes;
