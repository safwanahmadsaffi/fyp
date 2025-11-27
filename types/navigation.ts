import { Shop } from './shop';
import { Leave } from './leaves';

export type RootStackParamList = {
  Login: undefined;
  ForgotPasswordEmail: undefined;
  ForgotPasswordOTP: { email: string };
  ForgotPasswordNewPassword: { email: string; otp: string };
  Dashboard: { updatedShops?: Shop[]; leaves: Leave[] } | undefined;
  Home: undefined;
  Shops: { shops: Shop[]; onUpdate?: (shops: Shop[]) => void };
  // ShopDetails: accepts a shopId and optionally the full shop object and
  // an onUpdate callback which receives the updated single Shop.
  ShopDetails: { shopId: string; shop?: Shop; onUpdate?: (updatedShop: Shop) => void };
  Leaves: { leaves?: Leave[]; onUpdate?: (leaves: Leave[]) => void };
  Profile: undefined;
  ChangePassword: undefined;
  History: { visitedShops: Shop[] };
  ShopVisit: { shopId: string; visitId: string; onComplete: () => void };
  CheckinHistory: undefined;
};
