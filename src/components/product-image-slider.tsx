import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Package } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ProductImageSlider({
  images,
  alt,
  aspectClassName = "aspect-square",
}: {
  images: string[];
  alt: string;
  aspectClassName?: string;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: images.length > 1, align: "start" });
  const [index, setIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  if (images.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-lg border border-border bg-secondary",
          aspectClassName,
        )}
      >
        <div className="flex flex-col items-center gap-2 px-6 text-center">
          <Package className="size-16 text-muted-foreground" />
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Photo coming soon
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-lg border border-border bg-secondary">
        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex touch-pan-y">
            {images.map((src) => (
              <div key={src} className="min-w-0 shrink-0 grow-0 basis-full">
                <div className={aspectClassName}>
                  <img src={src} alt={alt} className="h-full w-full object-cover" />
                </div>
              </div>
            ))}
          </div>
        </div>
        {images.length > 1 ? (
          <>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute left-2 top-1/2 size-9 -translate-y-1/2 rounded-full shadow-md sm:left-3"
              onClick={() => emblaApi?.scrollPrev()}
              aria-label="Previous image"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute right-2 top-1/2 size-9 -translate-y-1/2 rounded-full shadow-md sm:right-3"
              onClick={() => emblaApi?.scrollNext()}
              aria-label="Next image"
            >
              <ChevronRight className="size-4" />
            </Button>
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {images.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  aria-label={`Image ${i + 1}`}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === index ? "w-6 bg-accent" : "w-1.5 bg-background/70",
                  )}
                  onClick={() => emblaApi?.scrollTo(i)}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
      {images.length > 1 ? (
        <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => emblaApi?.scrollTo(i)}
              className={cn(
                "aspect-square overflow-hidden rounded-md border",
                i === index ? "border-accent ring-1 ring-accent" : "border-border",
              )}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
