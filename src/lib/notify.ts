import { toast } from "sonner";

export function toastAddedToCart(name: string) {
  toast.success(`${name} added to cart`, { duration: 1600, id: "added-to-cart" });
}
