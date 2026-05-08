export type Role = "PET_PARENT" | "PROVIDER";

export type ServiceType = "WALKING" | "SITTING" | "GROOMING" | "BOARDING";

export type BookingState =
  | "REQUESTED"
  | "CONFIRMED"
  | "OTP_READY"
  | "IN_PROGRESS"
  | "PENDING_END_OTP"
  | "PENDING_PAYMENT"
  | "PAYMENT_LOCKED"
  | "COMPLETED"
  | "PAYOUT_PENDING"
  | "PAID_OUT"
  | "CANCELLED_BY_OWNER"
  | "CANCELLED_BY_PROVIDER"
  | "DISPUTED";

export type PaymentStage = "DEPOSIT" | "FINAL" | "PAYOUT";

export type AppUser = {
  id: string;
  supabaseUserId: string;
  phone: string | null;
  email: string | null;
  name: string | null;
  role: Role | null;
  city: string;
};

export type Pet = {
  id: string;
  ownerId: string;
  name: string;
  species: string;
  breed: string | null;
  ageYears: number | null;
  weightKg: string | null;
  notes: string | null;
};

export type BookingListItem = {
  id: string;
  state: BookingState;
  serviceType: ServiceType;
  address: string;
  startsAt: string;
  endsAt: string;
  estimatedAmount: string;
  depositAmount: string;
  finalAmount: string;
  pet: { id: string; name: string; species: string };
  owner: { id: string; name: string | null; phone: string | null };
  provider: { id: string; name: string | null; phone: string | null };
};

export type ProviderProfile = {
  id: string;
  userId: string;
  bio: string | null;
  serviceTypes: ServiceType[];
  baseRate: string;
  rating: string;
  completedJobs: number;
  latitude: string;
  longitude: string;
  radiusKm: number;
  isVerified: boolean;
  isAvailable: boolean;
  city: string;
};

export type NearbyProvider = {
  id: string;
  userId: string;
  rating: string;
  completedJobs: number;
  distance_km: number;
  baseRate: string;
  score?: number;
};

export type ChatMessage = {
  id: string;
  bookingId: string;
  senderId: string;
  receiverId: string;
  body: string;
  createdAt: string;
};
