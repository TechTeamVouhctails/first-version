-- Optional Razorpay Route linked account ID on providers (sandbox / production Route).
ALTER TABLE "ProviderProfile" ADD COLUMN "routeLinkedAccountId" TEXT;
