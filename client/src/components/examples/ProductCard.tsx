import ProductCard from '../ProductCard';
import heroImage from '@assets/generated_images/White_t-shirt_product_mockup_16dd597d.png';

export default function ProductCardExample() {
  return (
    <ProductCard
      id="1"
      imageUrl={heroImage}
      quote="The only way to do great work is to love what you do"
      author="Steve Jobs"
      price={29.99}
      weekNumber={42}
    />
  );
}
