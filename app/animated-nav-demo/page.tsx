// app/animated-nav-demo/page.tsx
import { AnimatedNavFramer } from "@/components/ui/animated-nav-framer";

export default function AnimatedNavDemo() {
  return (
    <>
      <AnimatedNavFramer />
      <main className="container mx-auto px-4">
        <div className="h-screen pt-24 flex flex-col items-center justify-center">
          <h1 className="text-4xl md:text-6xl font-bold text-center mb-6">
            Navigation with Framer Motion
          </h1>
          <p className="text-center text-muted-foreground text-lg md:text-xl max-w-2xl">
            Scroll down to see the magic. The navigation collapses into a circular button 
            when you scroll down and expands back when you scroll up. Click the circle to expand it manually.
          </p>
        </div>
        
        <div className="min-h-[200vh] bg-muted rounded-lg p-8 md:p-16">
          <h2 className="text-2xl md:text-4xl font-bold mb-6">Page Content</h2>
          <p className="text-lg md:text-xl mb-4 text-muted-foreground">
            This animation is powered by Framer Motion, providing a fluid,
            physics-based feel that matches the PhishForge design aesthetic.
          </p>
          
          <div className="mt-12 space-y-8">
            <div className="p-6 bg-background rounded-lg border">
              <h3 className="text-xl font-semibold mb-3">Scroll Behavior</h3>
              <p className="text-muted-foreground">
                The navigation automatically collapses when you scroll down past 150px 
                and re-expands when you scroll up by at least 80px.
              </p>
            </div>
            
            <div className="p-6 bg-background rounded-lg border">
              <h3 className="text-xl font-semibold mb-3">Interactive</h3>
              <p className="text-muted-foreground">
                Click the collapsed circular button to manually expand the navigation 
                at any time. The component features smooth spring animations.
              </p>
            </div>
            
            <div className="p-6 bg-background rounded-lg border">
              <h3 className="text-xl font-semibold mb-3">Responsive Design</h3>
              <p className="text-muted-foreground">
                The navigation adapts to different screen sizes with appropriate 
                spacing and maintains the PhishForge design system's warm aesthetic.
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
