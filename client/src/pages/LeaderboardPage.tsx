import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, User, Calendar, Award } from "lucide-react";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import tshirtMockup from "@assets/generated_images/blank_black_t-shirt_mockup.png";
import { queryClient } from "@/lib/queryClient";
import { getShirtQuoteStyles } from "@/lib/shirtTextSizing";

interface ShirtArchiveItem {
  winnerId: string;
  quoteId: string;
  quoteText: string;
  voteCount: number;
  authorId: string;
  authorUsername: string | null;
  authorFirstName: string | null;
  authorLastName: string | null;
  authorProfileImageUrl: string | null;
  productId: string | null;
  productName: string | null;
  productPrice: string | null;
  productImageUrl: string | null;
  productIsActive: boolean | null;
  weekStartDate: string;
  weekEndDate: string;
  finalVoteCount: number;
  createdAt: string;
}

export default function LeaderboardPage() {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  // Clear any stale cache on mount - force fresh data
  useEffect(() => {
    queryClient.removeQueries({ queryKey: ["/api/shirt-archive"] });
  }, []);

  // Generate QR code for quote-it.co
  useEffect(() => {
    QRCode.toDataURL('https://quote-it.co', {
      width: 64,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    }).then(url => {
      setQrCodeUrl(url);
    }).catch(err => {
      console.error('Failed to generate QR code:', err);
    });
  }, []);

  // Fetch shirt archive - force fresh data with timestamp cache-buster
  const { data: shirtArchive = [], isLoading: isLoadingArchive } = useQuery<ShirtArchiveItem[]>({
    queryKey: ["/api/shirt-archive"],
    queryFn: async () => {
      const response = await fetch(`/api/shirt-archive?_t=${Date.now()}`, {
        credentials: "include",
        cache: "no-store",
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch archive');
      const data = await response.json();
      console.log('[LeaderboardPage] Archive data received:', data.length, 'items:', JSON.stringify(data.map((d: ShirtArchiveItem) => d.winnerId)));
      return data;
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });

  const getAuthorDisplayName = (item: ShirtArchiveItem) => {
    if (item.authorFirstName && item.authorLastName) {
      return `${item.authorFirstName} ${item.authorLastName}`;
    }
    return item.authorUsername || 'Anonymous';
  };

  const formatWeekRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`;
  };

  return (
    <div className="min-h-screen pb-32 md:pb-8 pt-16">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Archive Header */}
        <div className="flex items-center gap-3 mb-6">
          <Award className="w-8 h-8" />
          <div>
            <h2 className="text-3xl font-bold font-display">Archive</h2>
            <p className="text-muted-foreground">All past winning quotes</p>
          </div>
        </div>

        {/* Archive Content */}
        <div>
          {isLoadingArchive ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Loading archive...</p>
            </div>
          ) : shirtArchive && shirtArchive.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2">
              {shirtArchive.map((item, index) => (
                <Card 
                  key={item.winnerId} 
                  className="overflow-hidden"
                  data-testid={`archive-shirt-${index}`}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col space-y-3">
                      {/* Week Badge */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          <span>{formatWeekRange(item.weekStartDate, item.weekEndDate)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Trophy className="w-4 h-4 text-yellow-500" />
                          <span className="text-sm font-medium">{item.finalVoteCount} votes</span>
                        </div>
                      </div>

                      {/* T-shirt Mockup with Quote */}
                      <div className="aspect-square bg-[#e5e1dc] rounded-lg overflow-hidden relative">
                        <img
                          src={tshirtMockup}
                          alt={`T-shirt with quote: ${item.quoteText}`}
                          className="w-full h-full object-contain"
                        />
                        
                        {/* Quote Overlay - Positioned within the actual printable chest area */}
                        {(() => {
                          const textStyles = getShirtQuoteStyles(item.quoteText, false);
                          return (
                            <div 
                              className="absolute"
                              style={{ 
                                left: '32%', 
                                right: '32%', 
                                top: '30%',
                              }}
                            >
                              <p 
                                className="text-white text-center"
                                style={{ 
                                  fontFamily: 'Georgia, "Times New Roman", serif',
                                  fontSize: textStyles.fontSize,
                                  fontWeight: 400,
                                  lineHeight: textStyles.lineHeight,
                                  letterSpacing: textStyles.letterSpacing,
                                }}
                              >
                                {`\u201C${item.quoteText}\u201D`}
                              </p>
                              
                              {/* Author Line with QR Code */}
                              <div className="flex items-center justify-center gap-1 mt-1">
                                <p 
                                  className="text-white"
                                  style={{ 
                                    fontFamily: 'Georgia, "Times New Roman", serif',
                                    fontSize: textStyles.authorFontSize,
                                    fontWeight: 400,
                                    fontStyle: 'italic',
                                  }}
                                >
                                  —{getAuthorDisplayName(item)}
                                </p>
                                {qrCodeUrl && (
                                  <img 
                                    src={qrCodeUrl} 
                                    alt="QR code to quote-it.co"
                                    className="h-2 w-2"
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Author info below mockup */}
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage 
                            src={item.authorProfileImageUrl || undefined} 
                            alt={getAuthorDisplayName(item)} 
                          />
                          <AvatarFallback>
                            <User className="w-4 h-4" />
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">
                          {getAuthorDisplayName(item)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-muted/30 rounded-md">
              <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground text-lg mb-2">No winners yet</p>
              <p className="text-sm text-muted-foreground">
                Past winning quotes will appear here!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
