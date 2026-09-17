"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { capturarUtmsDaUrl } from "@/lib/analytics/utm";
import { trackPageView } from "@/lib/analytics/pixel";

function MetaPixelTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inicial = useRef(true);

  // Captura UTMs da URL e rastreia PageView na montagem e em cada transição de rota
  useEffect(() => {
    capturarUtmsDaUrl();
    if (inicial.current) {
      inicial.current = false;
      return;
    }
    trackPageView();
  }, [pathname, searchParams]);

  return null;
}

export function MetaPixel({ id }: { id?: string }) {
  const pixelId = id || process.env.NEXT_PUBLIC_META_PIXEL_ID || "1101648275753987";

  return (
    <>
      <Suspense fallback={null}>
        <MetaPixelTracker />
      </Suspense>
      {pixelId && (
        <>
          <script
            id="meta-pixel-script"
            dangerouslySetInnerHTML={{
              __html: `
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${pixelId}');
                fbq('track', 'PageView');
              `,
            }}
          />
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        </>
      )}
    </>
  );
}
