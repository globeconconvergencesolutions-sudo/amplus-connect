import { DELIVERY_OPTIONS } from "@/lib/company";

const PAID_STATUSES = ["PAID", "FULFILLED", "SHIPPED", "DELIVERED"] as const;

export function isPickupOption(option: string | null | undefined) {
  const value = (option ?? "").toLowerCase();
  return value === "pickup" || value.includes("pickup") || value.includes("collect");
}

export function isPaidPipeline(status: string) {
  return (PAID_STATUSES as readonly string[]).includes(status);
}

export function deliveryLabel(option: string | null | undefined) {
  const match = DELIVERY_OPTIONS.find((row) => row.id === option);
  if (match) return match.label;
  if (!option) return "Delivery";
  return option.replaceAll("-", " ");
}

export type FulfilmentStep = {
  key: string;
  title: string;
  detail: string;
  done: boolean;
  current: boolean;
};

export function fulfilmentSteps(status: string, deliveryOption: string | null | undefined): FulfilmentStep[] {
  const pickup = isPickupOption(deliveryOption);
  const rank =
    status === "DELIVERED" ? 3 : status === "SHIPPED" ? 2 : status === "FULFILLED" ? 1 : status === "PAID" ? 0 : -1;

  const packed: FulfilmentStep = {
    key: "paid",
    title: "Payment confirmed",
    detail: "We have matched your payment. The yard is preparing the order.",
    done: rank >= 0,
    current: rank === 0,
  };

  if (pickup) {
    return [
      packed,
      {
        key: "ready",
        title: "Ready for collection",
        detail: "Collect from the Amplus yard, Mombasa Road, during opening hours. Bring this order code.",
        done: rank >= 1,
        current: rank === 1,
      },
      {
        key: "collected",
        title: "Collected",
        detail: "You have collected the materials. Thank you for building with Amplus.",
        done: rank >= 3,
        current: rank === 3,
      },
    ];
  }

  return [
    packed,
    {
      key: "prepared",
      title: "Being prepared",
      detail: "The team is picking and packing your materials.",
      done: rank >= 1,
      current: rank === 1,
    },
    {
      key: "shipped",
      title: "Out for delivery",
      detail: "Your order is on the way. Keep your phone on for the driver.",
      done: rank >= 2,
      current: rank === 2,
    },
    {
      key: "delivered",
      title: "Delivered",
      detail: "The materials have been handed over.",
      done: rank >= 3,
      current: rank === 3,
    },
  ];
}

export function nextFulfilment(status: string, deliveryOption: string | null | undefined) {
  const pickup = isPickupOption(deliveryOption);
  if (status === "PAID") {
    return {
      status: "FULFILLED" as const,
      label: pickup ? "Mark ready for collection" : "Mark as being prepared",
    };
  }
  if (status === "FULFILLED") {
    if (pickup) {
      return { status: "DELIVERED" as const, label: "Mark collected" };
    }
    return { status: "SHIPPED" as const, label: "Mark out for delivery" };
  }
  if (status === "SHIPPED") {
    return { status: "DELIVERED" as const, label: "Mark delivered" };
  }
  return null;
}
