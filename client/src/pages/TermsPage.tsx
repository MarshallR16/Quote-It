import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen pb-20 md:pb-8 pt-16">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Card className="p-8">
          <h1 className="text-4xl font-bold mb-2 font-display">Terms of Service</h1>
          <p className="text-sm text-muted-foreground mb-8">
            Last updated: November 2025
          </p>

          <div className="prose prose-sm max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-bold mb-3">1. Acceptance of Terms</h2>
              <p>
                By creating an account and using Quote-It, you agree to these Terms of Service. 
                If you do not agree, please do not use our platform.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">2. Content Ownership & Licensing</h2>
              <p className="mb-3">
                <strong>Important:</strong> When you post a quote on Quote-It, you grant us certain rights to use that content.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Ownership:</strong> You retain ownership of the quotes you post. However, you must have the right to post them.
                </li>
                <li>
                  <strong>Merchandise Rights:</strong> By posting a quote, you grant Quote-It a <strong>worldwide, royalty-free, non-exclusive license</strong> to:
                  <ul className="list-circle pl-6 mt-2 space-y-1">
                    <li>Display your quote on the platform</li>
                    <li>Print your quote on merchandise (T-shirts, products)</li>
                    <li>Sell merchandise featuring your quote</li>
                    <li>Use your quote in promotional materials for Quote-It</li>
                  </ul>
                </li>
                <li>
                  <strong>Weekly Winners:</strong> If your quote becomes the "Shirt of the Week," it will be printed on premium T-shirts and sold in our store.
                </li>
                <li>
                  <strong>Author Attribution:</strong> By default, your username will be included on merchandise featuring your quote. Buyers may choose to purchase the item without author attribution if they prefer.
                </li>
                <li>
                  <strong>No Compensation:</strong> You will not receive financial compensation if your quote is selected for merchandise. The honor and recognition of being featured is the reward.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">3. Content Guidelines</h2>
              <p className="mb-2">You agree that all quotes you post:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Must not violate copyright, trademark, or intellectual property rights</li>
                <li>Must not contain hate speech, harassment, or discriminatory content</li>
                <li>Must not contain explicit, vulgar, or inappropriate content</li>
                <li>Must be appropriate for printing on merchandise sold to the general public</li>
                <li>Must comply with all applicable laws</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">4. User Accounts</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>You must provide accurate information when creating an account</li>
                <li>You must use your real first and last name</li>
                <li>You are responsible for maintaining the security of your account</li>
                <li>You must not create multiple accounts to manipulate voting</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">5. Voting & Weekly Selection</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Users vote on quotes to determine the weekly winner</li>
                <li>Voting must be genuine and not manipulated</li>
                <li>Quote-It reserves the right to disqualify quotes that violate our guidelines</li>
                <li>Weekly winners are selected automatically based on vote count</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">6. Merchandise & Sales</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>All merchandise sales are final</li>
                <li>We use third-party fulfillment (Printful) for production and shipping</li>
                <li>Delivery times and shipping costs are managed by our fulfillment partner</li>
                <li>Refunds or exchanges are handled according to our return policy</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">7. Termination</h2>
              <p>
                Quote-It reserves the right to suspend or terminate accounts that violate these terms, 
                post inappropriate content, or engage in fraudulent activity.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">8. Changes to Terms</h2>
              <p>
                We may update these terms from time to time. Continued use of Quote-It after changes 
                constitutes acceptance of the new terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">9. Contact</h2>
              <p>
                If you have questions about these terms, please contact us through the platform.
              </p>
            </section>

            <div className="mt-12 p-6 bg-muted/50 rounded-md border">
              <p className="text-sm">
                <strong>Summary:</strong> By using Quote-It, you agree that quotes you post can be printed on merchandise 
                and sold through our platform. You retain ownership but grant us the right to use your content for this purpose. 
                No financial compensation is provided for featured quotes.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
