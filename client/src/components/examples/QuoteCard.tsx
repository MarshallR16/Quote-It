import QuoteCard from '../QuoteCard';

export default function QuoteCardExample() {
  return (
    <QuoteCard
      id="1"
      content="The only way to do great work is to love what you do"
      author="Steve Jobs"
      upvotes={156}
      downvotes={12}
      timeAgo="2 hours ago"
    />
  );
}
