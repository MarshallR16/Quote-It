import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Trophy, ShoppingBag } from "lucide-react";

export default function AdminPage() {
  const { toast } = useToast();

  const { data: weeklyWinner, isLoading: isLoadingWinner } = useQuery({
    queryKey: ["/api/products/weekly-winner"],
  });

  const selectWinnerMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/select-weekly-winner", {});
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products/weekly-winner"] });
      toast({
        title: "Weekly winner selected!",
        description: `Quote: "${data.quote.text.substring(0, 50)}..."`,
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

  const createProductMutation = useMutation({
    mutationFn: async (data: { quoteId: string; weeklyWinnerId?: string }) => {
      const res = await apiRequest("POST", "/api/products/create-printful", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/weekly-winner"] });
      toast({
        title: "Product created!",
        description: "Printful product has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create Printful product",
        variant: "destructive",
      });
    },
  });

  const handleCreateProduct = () => {
    if (weeklyWinner && weeklyWinner.quote) {
      createProductMutation.mutate({
        quoteId: weeklyWinner.quote.id,
        weeklyWinnerId: weeklyWinner.winner.id,
      });
    }
  };

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
            <h2 className="text-xl font-bold">Weekly Winner Selection</h2>
          </div>
          <p className="text-muted-foreground mb-4">
            Select the quote with the highest votes as this week's winner
          </p>
          <Button
            onClick={() => selectWinnerMutation.mutate()}
            disabled={selectWinnerMutation.isPending}
            data-testid="button-select-winner"
          >
            {selectWinnerMutation.isPending ? "Selecting..." : "Select Weekly Winner"}
          </Button>
        </Card>

        {isLoadingWinner ? (
          <Card className="p-6">
            <p className="text-muted-foreground">Loading current winner...</p>
          </Card>
        ) : weeklyWinner ? (
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <ShoppingBag className="w-6 h-6" />
              <h2 className="text-xl font-bold">Current Winner → Printful Product</h2>
            </div>
            <div className="mb-4">
              <p className="text-lg font-medium mb-2">"{weeklyWinner.quote.text}"</p>
              <p className="text-sm text-muted-foreground">- {weeklyWinner.quote.authorId}</p>
              <p className="text-sm text-muted-foreground mt-2">
                Votes: {weeklyWinner.winner.finalVoteCount}
              </p>
            </div>
            {weeklyWinner.product ? (
              <div className="bg-muted/30 rounded-md p-4">
                <p className="text-sm text-muted-foreground">
                  ✓ Product already created in Printful
                </p>
                <p className="text-sm font-medium mt-1">
                  Printful ID: {weeklyWinner.product.printfulSyncProductId}
                </p>
              </div>
            ) : (
              <Button
                onClick={handleCreateProduct}
                disabled={createProductMutation.isPending}
                data-testid="button-create-product"
              >
                {createProductMutation.isPending ? "Creating..." : "Create Printful Product"}
              </Button>
            )}
          </Card>
        ) : (
          <Card className="p-6">
            <p className="text-muted-foreground">No weekly winner selected yet. Select one above to get started.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
