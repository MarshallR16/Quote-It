import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import UserStats from "@/components/UserStats";
import QuoteCard from "@/components/QuoteCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDistanceToNow } from "date-fns";
import { Package, Loader2, LogOut, Settings, Share2, Copy, Check, Flame, Trophy, Upload, X, Trash2, AlertTriangle, HelpCircle } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth, uploadProfileImage } from "@/lib/firebase";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { QuoteWithAuthor } from "@shared/schema";

type Order = {
  id: string;
  productId: string;
  amount: string;
  status: string;
  createdAt: string;
  stripePaymentIntentId: string | null;
  printfulOrderId: number | null;
};

export default function ProfilePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: userQuotes = [], isLoading: quotesLoading } = useQuery<QuoteWithAuthor[]>({
    queryKey: [`/api/quotes/user/${user?.id}`],
    enabled: !!user?.id,
  });

  const { data: userOrders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: [`/api/orders/user/${user?.id}`],
    enabled: !!user?.id,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user?.id) throw new Error("User not authenticated");
      
      const url = await uploadProfileImage(user.id, file);
      await apiRequest("PUT", "/api/users/profile-image", { profileImageUrl: url });
      return url;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Profile picture updated",
        description: "Your profile picture has been updated successfully",
      });
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message || "Failed to upload profile picture",
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please select an image file",
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: "Image must be less than 5MB",
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    uploadMutation.mutate(selectedFile);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast({
        title: "Signed out",
        description: "You've been signed out successfully",
      });
      setLocation("/login");
    } catch (error: any) {
      console.error("Error signing out:", error);
      toast({
        variant: "destructive",
        title: "Sign out failed",
        description: error.message,
      });
    }
  };

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      // First cleanup database records (while we still have auth token)
      await apiRequest("DELETE", "/api/auth/delete-account");
      
      // Then delete the Firebase auth account (client-side has permission to delete own account)
      if (auth.currentUser) {
        await auth.currentUser.delete();
      }
    },
    onSuccess: () => {
      toast({
        title: "Account deleted",
        description: "Your account and all associated data have been permanently deleted",
      });
      // User is already signed out by Firebase delete, just redirect
      setLocation("/login");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Deletion failed",
        description: error.message || "Failed to delete account",
      });
    }
  });

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") {
      toast({
        variant: "destructive",
        title: "Confirmation required",
        description: "Please type DELETE to confirm account deletion",
      });
      return;
    }
    
    deleteAccountMutation.mutate();
  };

  if (!user) {
    return (
      <div className="min-h-screen pb-20 md:pb-8 pt-16 flex items-center justify-center">
        <p className="text-muted-foreground">Please log in to view your profile</p>
      </div>
    );
  }

  const totalVotes = userQuotes.reduce((sum, q) => sum + q.voteCount, 0);
  const wins = 0; // TODO: Implement weekly winners tracking

  const username = user.firstName && user.lastName 
    ? `${user.firstName} ${user.lastName}`
    : user.firstName || user.lastName || "Anonymous";

  const joinDate = user.createdAt 
    ? formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })
    : "recently";

  return (
    <div className="min-h-screen pb-20 md:pb-8 pt-16">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-3">
          {/* User Stats - Sticky on desktop */}
          <div className="md:col-span-1">
            <div className="md:sticky md:top-24">
              <UserStats
                username={username}
                joinDate={joinDate}
                postsCount={userQuotes.length}
                totalVotes={totalVotes}
                wins={wins}
                profileImageUrl={user.profileImageUrl}
                onEditProfilePicture={() => setUploadDialogOpen(true)}
              />
            </div>
          </div>

          {/* User's Content */}
          <div className="md:col-span-2 space-y-8">
            {/* Daily Streak Section */}
            <Card data-testid="card-streak">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  Daily Posting Streak
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div className="text-center space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <Flame className="w-8 h-8 text-orange-500" />
                      <div className="text-4xl font-bold font-display" data-testid="text-current-streak">
                        {user.currentStreak || 0}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">Current Streak</div>
                    <p className="text-xs text-muted-foreground">
                      {user.currentStreak === 0 ? "Post today to start a streak!" : 
                       user.currentStreak === 1 ? "Keep it going! Post tomorrow" :
                       `${user.currentStreak} days in a row!`}
                    </p>
                  </div>
                  <div className="text-center space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <Trophy className="w-8 h-8 text-yellow-500" />
                      <div className="text-4xl font-bold font-display text-muted-foreground" data-testid="text-longest-streak">
                        {user.longestStreak || 0}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">Best Streak</div>
                    <p className="text-xs text-muted-foreground">
                      {user.longestStreak === 0 ? "Your personal record" : 
                       user.longestStreak === user.currentStreak ? "You're at your best!" :
                       `Can you beat ${user.longestStreak}?`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Referral Section */}
            {user.referralCode && (
              <Card data-testid="card-referral">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Share2 className="w-5 h-5" />
                    Referral Program
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Share your referral code! Each person who signs up gives you one 10% off purchase.
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-muted rounded-md px-4 py-3 font-mono text-lg font-bold">
                      {user.referralCode}
                    </div>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(user.referralCode || '');
                        setCopiedReferral(true);
                        setTimeout(() => setCopiedReferral(false), 2000);
                        toast({
                          title: "Copied!",
                          description: "Referral code copied to clipboard",
                        });
                      }}
                      data-testid="button-copy-referral"
                    >
                      {copiedReferral ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-4 pt-2">
                    <div className="text-center">
                      <div className="text-3xl font-bold font-display" data-testid="text-referral-count">
                        {user.referralCount || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Referrals</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold font-display text-primary" data-testid="text-available-discounts">
                        {Math.max(0, (user.referralCount || 0) - (user.usedReferralDiscounts || 0))}
                      </div>
                      <div className="text-sm text-muted-foreground">Available</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold font-display text-muted-foreground" data-testid="text-used-discounts">
                        {user.usedReferralDiscounts || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">Used</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* User's Quotes */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold font-display" data-testid="heading-my-quotes">My Quotes</h2>
              {quotesLoading ? (
                <div className="flex justify-center py-8" data-testid="loading-quotes">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : userQuotes.length === 0 ? (
                <Card data-testid="empty-quotes">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    You haven't posted any quotes yet
                  </CardContent>
                </Card>
              ) : (
                userQuotes.map((quote) => {
                  return (
                    <QuoteCard
                      key={quote.id}
                      id={quote.id}
                      content={quote.text}
                      author={quote.authorUsername || 'Unknown'}
                      authorId={quote.authorId}
                      authorProfileImageUrl={quote.authorProfileImageUrl}
                      upvotes={Math.max(0, quote.voteCount)}
                      downvotes={0}
                      timeAgo={formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true })}
                    />
                  );
                })
              )}
            </div>

            {/* Order History */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold font-display" data-testid="heading-order-history">Order History</h2>
              {ordersLoading ? (
                <div className="flex justify-center py-8" data-testid="loading-orders">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : userOrders.length === 0 ? (
                <Card data-testid="empty-orders">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No orders yet
                  </CardContent>
                </Card>
              ) : (
                userOrders.map((order) => (
                  <Card key={order.id} data-testid={`order-${order.id}`}>
                    <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
                      <Package className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <CardTitle className="text-base">
                          Order #{order.id.substring(0, 8)}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">${order.amount}</p>
                        <p className={`text-sm ${
                          order.status === 'completed' ? 'text-green-600' : 
                          order.status === 'failed' ? 'text-red-600' : 
                          'text-yellow-600'
                        }`} data-testid={`order-status-${order.id}`}>
                          {order.status}
                        </p>
                      </div>
                    </CardHeader>
                    {order.printfulOrderId && (
                      <CardContent className="pt-2">
                        <p className="text-sm text-muted-foreground">
                          Printful Order: #{order.printfulOrderId}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                ))
              )}
            </div>

            {/* Settings */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold font-display flex items-center gap-2" data-testid="heading-settings">
                <Settings className="h-6 w-6" />
                Settings
              </h2>
              <Card data-testid="card-settings">
                <CardHeader>
                  <CardTitle className="text-lg">Account</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Email</p>
                    <p className="text-base" data-testid="text-account-email">{user.email}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Display Name</p>
                    <p className="text-base" data-testid="text-account-name">{username}</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Member Since</p>
                    <p className="text-base" data-testid="text-account-joined">{joinDate}</p>
                  </div>

                  <div className="pt-4 border-t space-y-2">
                    <Button
                      variant="outline"
                      onClick={() => setLocation("/support")}
                      className="w-full gap-2"
                      data-testid="button-contact-support"
                    >
                      <HelpCircle className="h-4 w-4" />
                      Contact Support
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleSignOut}
                      className="w-full gap-2"
                      data-testid="button-sign-out"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setDeleteDialogOpen(true)}
                      className="w-full gap-2 text-destructive hover:text-destructive"
                      data-testid="button-delete-account"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Account
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Picture Upload Dialog */}
      <Dialog 
        open={uploadDialogOpen} 
        onOpenChange={(open) => {
          setUploadDialogOpen(open);
          if (!open) {
            setSelectedFile(null);
            setPreviewUrl(null);
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
          }
        }}
      >
        <DialogContent data-testid="dialog-upload-profile-picture">
          <DialogHeader>
            <DialogTitle>Upload Profile Picture</DialogTitle>
            <DialogDescription>
              Choose an image to use as your profile picture. Maximum size: 5MB.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {previewUrl ? (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="relative w-48 h-48">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-full object-cover rounded-full"
                      data-testid="img-preview"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-0 right-0 rounded-full"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                      data-testid="button-clear-preview"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={handleUpload}
                    disabled={uploadMutation.isPending}
                    data-testid="button-upload-confirm"
                  >
                    {uploadMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                    disabled={uploadMutation.isPending}
                    data-testid="button-choose-different"
                  >
                    Choose Different
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover-elevate"
                onClick={() => fileInputRef.current?.click()}
                data-testid="dropzone-select-image"
              >
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Click to select an image
                </p>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG, GIF up to 5MB
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              data-testid="input-file"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) setDeleteConfirmation("");
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete your account and remove all of your data from our servers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-destructive">This will delete:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Your profile and account information</li>
                <li>All quotes you've posted</li>
                <li>Your votes and follows</li>
                <li>Your referral code and credits</li>
              </ul>
            </div>
            <div className="space-y-2">
              <Label htmlFor="delete-confirmation">
                Type <span className="font-mono font-bold">DELETE</span> to confirm
              </Label>
              <Input
                id="delete-confirmation"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="DELETE"
                disabled={deleteAccountMutation.isPending}
                data-testid="input-delete-confirmation"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteConfirmation("");
              }}
              disabled={deleteAccountMutation.isPending}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteAccountMutation.isPending || deleteConfirmation !== "DELETE"}
              data-testid="button-confirm-delete"
            >
              {deleteAccountMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Account
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
