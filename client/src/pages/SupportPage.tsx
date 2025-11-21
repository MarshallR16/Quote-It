import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Mail, MessageSquare, HelpCircle } from "lucide-react";

export default function SupportPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const mailtoLink = `mailto:support@quote-it.co?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`From: ${email}\n\n${message}`)}`;
      window.location.href = mailtoLink;

      toast({
        title: "Opening email client",
        description: "Your default email app should open with your message.",
      });

      setEmail("");
      setSubject("");
      setMessage("");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to open email client. Please email us directly at support@quote-it.co",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const faqs = [
    {
      question: "How does Quote-It work?",
      answer: "Share your favorite quotes, vote on others' quotes, and the most popular quote each week becomes available as a premium T-shirt. If your quote wins, you get a free shirt!"
    },
    {
      question: "How do I win a free shirt?",
      answer: "Post a quote and get the most votes by the end of the week. The winning quote author receives a complimentary premium T-shirt automatically."
    },
    {
      question: "How does voting work?",
      answer: "You can upvote or downvote quotes on the Rate It page. Your votes help determine which quote wins each week and becomes featured on a T-shirt."
    },
    {
      question: "How do referrals work?",
      answer: "Share your unique referral code with friends. Each successful referral earns you a 10% discount code that you can use on T-shirt purchases in the store."
    },
    {
      question: "Can I delete my account?",
      answer: "Yes, you can delete your account from your profile settings. This will permanently remove all your data including quotes, votes, and purchase history."
    },
    {
      question: "How do I contact support?",
      answer: "Use the contact form below or email us directly at support@quote-it.co. We typically respond within 24-48 hours."
    }
  ];

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold font-display tracking-tight">Support</h1>
          <p className="text-muted-foreground">How can we help you?</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Contact Us
            </CardTitle>
            <CardDescription>
              Send us a message and we'll get back to you as soon as possible
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="text-sm font-medium mb-1.5 block">
                  Your Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-support-email"
                />
              </div>

              <div>
                <label htmlFor="subject" className="text-sm font-medium mb-1.5 block">
                  Subject
                </label>
                <Input
                  id="subject"
                  type="text"
                  placeholder="What's this about?"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  data-testid="input-support-subject"
                />
              </div>

              <div>
                <label htmlFor="message" className="text-sm font-medium mb-1.5 block">
                  Message
                </label>
                <Textarea
                  id="message"
                  placeholder="Tell us more about your question or issue..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={6}
                  data-testid="input-support-message"
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full"
                data-testid="button-submit-support"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                {isSubmitting ? "Sending..." : "Send Message"}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t">
              <p className="text-sm text-muted-foreground text-center">
                Or email us directly at{" "}
                <a
                  href="mailto:support@quote-it.co"
                  className="text-primary hover:underline font-medium"
                  data-testid="link-support-email"
                >
                  support@quote-it.co
                </a>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5" />
              Frequently Asked Questions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {faqs.map((faq, index) => (
              <div key={index} className="space-y-2">
                <h3 className="font-semibold text-base" data-testid={`faq-question-${index}`}>
                  {faq.question}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed" data-testid={`faq-answer-${index}`}>
                  {faq.answer}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
