import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import heroImage from "@assets/generated_images/Hero_lifestyle_t-shirt_photo_a1c8cecb.png";
import whiteShirtImage from "@assets/generated_images/White_t-shirt_product_mockup_16dd597d.png";
import blackShirtImage from "@assets/generated_images/Black_t-shirt_product_mockup_60fd9e55.png";

// TODO: remove mock functionality
const products = [
  {
    id: "1",
    imageUrl: whiteShirtImage,
    quote: "Be yourself; everyone else is already taken",
    author: "Oscar Wilde",
    price: 29.99,
    weekNumber: 42,
  },
  {
    id: "2",
    imageUrl: blackShirtImage,
    quote: "The future belongs to those who believe in the beauty of their dreams",
    author: "Eleanor Roosevelt",
    price: 29.99,
    weekNumber: 41,
  },
  {
    id: "3",
    imageUrl: whiteShirtImage,
    quote: "Life is what happens when you're busy making other plans",
    author: "John Lennon",
    price: 29.99,
    weekNumber: 40,
  },
];

export default function StorePage() {
  return (
    <div className="min-h-screen pb-20 md:pb-8 pt-16">
      {/* Hero Section */}
      <div className="relative h-96 md:h-[500px] overflow-hidden mb-12">
        <img
          src={heroImage}
          alt="Featured winning quote on t-shirt"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center text-center px-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 font-display">
              Wear Winning Quotes
            </h1>
            <p className="text-lg md:text-xl text-white/90 mb-6 max-w-2xl">
              Every week, the community's favorite quote becomes a premium T-shirt
            </p>
            <Button
              size="lg"
              className="rounded-full bg-white/90 text-black hover:bg-white backdrop-blur-sm h-12"
              data-testid="button-shop-collection"
              onClick={() => console.log('Shop collection clicked')}
            >
              Shop the Collection
            </Button>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-2xl font-bold font-display mb-6">Featured Designs</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} {...product} />
          ))}
        </div>
      </div>
    </div>
  );
}
