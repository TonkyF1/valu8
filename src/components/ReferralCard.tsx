import { Users } from "lucide-react";
import { ShareButtons, useMyReferral } from "@/components/ShareResult";

/** Profile "Share Valu8": personal ?ref link + count of friends who joined. No rewards, just thanks. */
export function ReferralCard() {
  const ref = useMyReferral();
  return (
    <section className="premium-card p-6 sm:p-7 mb-4" aria-labelledby="share-valu8-h">
      <div className="flex items-center gap-3 mb-4">
        <span className="h-10 w-10 rounded-xl bg-primary/15 text-primary grid place-items-center"><Users className="h-5 w-5" aria-hidden /></span>
        <div>
          <h2 id="share-valu8-h" className="font-semibold">Share Valu8</h2>
          <p className="text-xs text-muted-foreground">Valu8 is free. Help a friend avoid being lowballed on their car.</p>
        </div>
      </div>
      {!ref ? (
        <p className="text-sm text-muted-foreground">Loading your link…</p>
      ) : (
        <>
          <p className="text-sm">
            <span className="text-muted-foreground">Your link:</span>{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs break-all">https://valu8.uk/?ref={ref.code}</code>
          </p>
          <p className="text-sm mt-2"><strong className="tabular-nums">{ref.joined}</strong> {ref.joined === 1 ? "friend has" : "friends have"} joined with your link.</p>
          <div className="mt-4">
            <ShareButtons campaign="referral" path="/" text="I use Valu8 to check what cars are really worth. It's free and honest:" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">Friends only see the link. We count who joined with it; we never show you their details.</p>
        </>
      )}
    </section>
  );
}
