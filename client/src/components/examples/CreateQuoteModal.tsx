import CreateQuoteModal from '../CreateQuoteModal';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function CreateQuoteModalExample() {
  const [open, setOpen] = useState(false);
  
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Modal</Button>
      <CreateQuoteModal open={open} onOpenChange={setOpen} />
    </>
  );
}
