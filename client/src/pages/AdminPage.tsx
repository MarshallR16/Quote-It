import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Trophy } from "lucide-react";

export default function AdminPage() {
  const { toast } = useToast();

  const { data: weeklyWinner, isLoading: isLoadingWinner } = useQuery<any>({
    queryKey: ["/api/products/weekly-winner"],
  });

  const selectWinnerMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/select-weekly-winner", {});
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products/weekly-winner"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: data.product ? "Winner selected & product created!" : "Winner selected!",
        description: data.product 
          ? `Printful product created for: "${data.quote.text.substring(0, 50)}..."`
          : `Quote: "${data.quote.text.substring(0, 50)}..."`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to select weekly winner",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen pb-20 md:pb-8 pt-16">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-display mb-2">Admin Panel</h1>
          <p className="text-muted-foreground">Manage weekly winners and Printful products</p>
        </div>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="w-6 h-6" />
            <h2 className="text-xl font-bold">Automatic Weekly Winner</h2>
          </div>
          <p className="text-muted-foreground mb-4">
            Click to automatically select the quote with the highest votes and create a Printful T-shirt product
          </p>
          <Button
            onClick={() => selectWinnerMutation.mutate()}
            disabled={selectWinnerMutation.isPending}
            data-testid="button-select-winner"
          >
            {selectWinnerMutation.isPending ? "Processing..." : "Select Winner & Create Product"}
          </Button>
        </Card>

        {isLoadingWinner ? (
          <Card className="p-6">
            <p className="text-muted-foreground">Loading current winner...</p>
          </Card>
        ) : weeklyWinner ? (
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Current Weekly Product</h2>
            <div className="mb-4">
              <p className="text-lg font-medium mb-2">"{weeklyWinner.quote?.text}"</p>
              <p className="text-sm text-muted-foreground">- {weeklyWinner.quote?.authorId}</p>
              <p className="text-sm text-muted-foreground mt-2">
                Votes: {weeklyWinner.winner?.finalVoteCount}
              </p>
            </div>
            {weeklyWinner.product ? (
              <div className="bg-muted/30 rounded-md p-4">
                <p className="text-sm font-medium mb-1">
                  ✓ Printful product active
                </p>
                <p className="text-sm text-muted-foreground">
                  Printful ID: {weeklyWinner.product.printfulSyncProductId}
                </p>
                <p className="text-sm text-muted-foreground">
                  Price: ${weeklyWinner.product.price}
                </p>
              </div>
            ) : (
              <div className="bg-muted/30 rounded-md p-4">
                <p className="text-sm text-muted-foreground">
                  Product not yet created
                </p>
              </div>
            )}
          </Card>
        ) : (
          <Card className="p-6">
            <p className="text-muted-foreground">No weekly winner yet. Click the button above to select the top-voted quote and create the product automatically!</p>
          </Card>
        )}
      </div>
    </div>
  );
}
