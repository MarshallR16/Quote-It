import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ProductCardProps {
  id: string;
  imageUrl: string;
  quote: string;
  author: string;
  price: number;
  weekNumber?: number;
  onAddToCart?: (id: string) => void;
}

export default function ProductCard({
  id,
  imageUrl,
  quote,
  author,
  price,
  weekNumber,
  onAddToCart,
}: ProductCardProps) {
  const isForSale = onAddToCart !== undefined && price > 0;

  return (
    <Card className="overflow-hidden hover-elevate" data-testid={`card-product-${id}`}>
      <div className="aspect-square bg-muted overflow-hidden">
        <img
          src={imageUrl}
          alt={`T-shirt with quote: ${quote}`}
          className="w-full h-full object-cover"
          data-testid="img-product"
        />
      </div>
      <div className="p-6 space-y-4">
        {weekNumber && (
          <Badge variant="secondary" className="text-xs">
            Week #{weekNumber} Winner
          </Badge>
        )}
        <blockquote className="text-lg font-medium leading-tight line-clamp-2">
          "{quote}"
        </blockquote>
        <p className="text-xs text-muted-foreground" data-testid="text-product-author">
          -{author}
        </p>
        
        {isForSale ? (
          <div className="flex items-center justify-between gap-4">
            <span className="text-2xl font-bold" data-testid="text-product-price">
              ${price.toFixed(2)}
            </span>
            <Button
              className="rounded-full"
              onClick={() => onAddToCart(id)}
              data-testid="button-add-to-cart"
            >
              Buy Now
            </Button>
          </div>
        ) : (
          <div className="py-2">
            <Badge variant="outline" className="text-xs">
              Display Only - Not For Sale
            </Badge>
          </div>
        )}
      </div>
    </Card>
  );
}
