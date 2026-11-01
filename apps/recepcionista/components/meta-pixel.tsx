"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { capturarUtmsDaUrl } from "@/lib/analytics/utm";
import { trackPageView } from "@/lib/analytics/pixel";
import { idsDoPixel, pixelSemJavascript } from "@/lib/analytics/pixel-config";

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
  const pixelIds = idsDoPixel([id, process.env.NEXT_PUBLIC_META_PIXEL_ID, "1041816645171094"]);

  return (
    <>
      <Suspense fallback={null}>
        <MetaPixelTracker />
      </Suspense>
      {pixelIds.length > 0 && (
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
                ${pixelIds.map((p) => `fbq('init', '${p}');`).join("\n")}
                fbq('track', 'PageView');
              `,
            }}
          />
          <noscript dangerouslySetInnerHTML={{ __html: pixelSemJavascript(pixelIds) }} />
        </>
      )}
    </>
  );
}
