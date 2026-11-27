import { Suspense } from 'react';
import { Header } from '../components/landing/Header';
import { Hero } from '../components/landing/Hero';
import { Problems } from '../components/landing/Problems';
import { Pillars } from '../components/landing/Pillars';
import { Roles } from '../components/landing/Roles';
import { Differentiators } from '../components/landing/Differentiators';
import { Pilot } from '../components/landing/Pilot';
import { Faq } from '../components/landing/Faq';
import { Footer } from '../components/landing/Footer';
export default function Home() {
  return (
    <>
      <Suspense>
        <Header />
      </Suspense>
      <main className="landing-page">
        <Suspense>
          <Hero />
        </Suspense>
        <Suspense>
          <Problems />
        </Suspense>
        <Suspense>
          <Pillars />
        </Suspense>
        <Suspense>
          <Roles />
        </Suspense>
        <Suspense>
          <Differentiators />
        </Suspense>
        <Suspense>
          <Pilot />
        </Suspense>
        <Suspense>
          <Faq />
        </Suspense>
      </main>
      <Suspense>
        <Footer />
      </Suspense>
    </>
  );
}
