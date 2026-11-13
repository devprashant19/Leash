import { useEffect } from 'react';
import { MotionConfig } from 'motion/react';
import { StoreProvider, scrollToId, useStore } from './lib/store';
import { ProgressiveBlur } from './motion/Ambient';
import { Hero, Nav } from './sections/Top';
import { Checks, Intro, Stats } from './sections/Story';
import { DenyCodes, Rules } from './sections/Rules';
import { LiveDemo } from './sections/LiveDemo';
import { HowItWorks, Proof } from './sections/How';
import { Compare, FailureModes, FinalCta, Footer, Statement, UseFor, Where } from './sections/Closing';
import { ConsoleModal, TrySection } from './console/Console';

/** Shareable links: ?run runs the quick demo, ?tour the full feature tour (both scroll to it); ?try=N opens the console with example N. */
function DeepLinks() {
  const { run, openConsole } = useStore();
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.has('run') || q.has('tour')) { window.setTimeout(() => scrollToId('demo-run'), 400); run(q.has('tour') ? 'tour' : 'quick'); }
    if (q.has('try')) openConsole(Math.max(0, Number(q.get('try')) || 0));
  }, [run, openConsole]);
  return null;
}

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <StoreProvider>
        <DeepLinks />
        <a className="skip" href="#demo">Skip to the live demo</a>
        <Nav />
        <main>
          <Hero />
          <Checks />
          <Stats />
          <Intro />
          <Rules />
          <DenyCodes />
          <LiveDemo />
          <HowItWorks />
          <Proof />
          <Statement />
          <FailureModes />
          <Compare />
          <UseFor />
          <TrySection />
          <Where />
          <FinalCta />
        </main>
        <Footer />
        <ProgressiveBlur />
        <ConsoleModal />
      </StoreProvider>
    </MotionConfig>
  );
}
