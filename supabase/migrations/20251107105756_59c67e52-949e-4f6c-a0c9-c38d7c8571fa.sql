-- Create shop_items table
CREATE TABLE public.shop_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  original_price NUMERIC(10, 2) CHECK (original_price >= 0),
  category TEXT NOT NULL CHECK (category IN ('electronics', 'fashion', 'home', 'food', 'art', 'books', 'sports', 'toys', 'other')),
  condition TEXT NOT NULL CHECK (condition IN ('new', 'used', 'refurbished')),
  brand TEXT,
  location TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'removed')),
  images TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create shop_item_stats table
CREATE TABLE public.shop_item_stats (
  item_id UUID NOT NULL PRIMARY KEY REFERENCES public.shop_items(id) ON DELETE CASCADE,
  likes_count INTEGER NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
  shares_count INTEGER NOT NULL DEFAULT 0 CHECK (shares_count >= 0),
  comments_count INTEGER NOT NULL DEFAULT 0 CHECK (comments_count >= 0),
  views_count INTEGER NOT NULL DEFAULT 0 CHECK (views_count >= 0),
  saves_count INTEGER NOT NULL DEFAULT 0 CHECK (saves_count >= 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create seller_profiles table
CREATE TABLE public.seller_profiles (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_name TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  phone TEXT,
  email TEXT NOT NULL,
  location TEXT NOT NULL,
  joined_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  total_sales INTEGER NOT NULL DEFAULT 0 CHECK (total_sales >= 0),
  total_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_revenue >= 0),
  response_rate INTEGER NOT NULL DEFAULT 100 CHECK (response_rate >= 0 AND response_rate <= 100),
  avg_response_time INTERVAL NOT NULL DEFAULT '2 hours',
  badges TEXT[] NOT NULL DEFAULT '{}'
);

-- Create seller_stats table
CREATE TABLE public.seller_stats (
  seller_id UUID NOT NULL PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating NUMERIC(3, 2) NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  reviews_count INTEGER NOT NULL DEFAULT 0 CHECK (reviews_count >= 0),
  active_listings INTEGER NOT NULL DEFAULT 0 CHECK (active_listings >= 0),
  followers_count INTEGER NOT NULL DEFAULT 0 CHECK (followers_count >= 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create shop_item_likes table
CREATE TABLE public.shop_item_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.shop_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(item_id, user_id)
);

-- Create shop_item_comments table
CREATE TABLE public.shop_item_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.shop_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.shop_item_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create shop_item_saves table
CREATE TABLE public.shop_item_saves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.shop_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(item_id, user_id)
);

-- Create seller_follows table
CREATE TABLE public.seller_follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(seller_id, follower_id),
  CHECK (seller_id <> follower_id)
);

-- Create flash_sales table
CREATE TABLE public.flash_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.shop_items(id) ON DELETE CASCADE,
  original_price NUMERIC(10, 2) NOT NULL CHECK (original_price >= 0),
  sale_price NUMERIC(10, 2) NOT NULL CHECK (sale_price >= 0 AND sale_price < original_price),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  quantity_limit INTEGER CHECK (quantity_limit > 0),
  quantity_sold INTEGER NOT NULL DEFAULT 0 CHECK (quantity_sold >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

-- Create group_buys table
CREATE TABLE public.group_buys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.shop_items(id) ON DELETE CASCADE,
  min_participants INTEGER NOT NULL CHECK (min_participants > 1),
  current_participants INTEGER NOT NULL DEFAULT 0 CHECK (current_participants >= 0),
  discount_percentage INTEGER NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100),
  end_time TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create group_buy_participants table
CREATE TABLE public.group_buy_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_buy_id UUID NOT NULL REFERENCES public.group_buys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_buy_id, user_id)
);

-- Create orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
  shipping_cost NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
  tax NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (tax >= 0),
  total NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  estimated_delivery TIMESTAMP WITH TIME ZONE
);

-- Create order_items table
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.shop_items(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_at_purchase NUMERIC(10, 2) NOT NULL CHECK (price_at_purchase >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled'))
);

-- Create shipping_addresses table
CREATE TABLE public.shipping_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  street TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  country TEXT NOT NULL,
  phone TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payment_methods table
CREATE TABLE public.payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('card', 'paypal', 'apple_pay', 'google_pay')),
  last_four TEXT,
  card_brand TEXT,
  expiry_month INTEGER CHECK (expiry_month >= 1 AND expiry_month <= 12),
  expiry_year INTEGER CHECK (expiry_year >= 2024),
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create product_reviews table
CREATE TABLE public.product_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.shop_items(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  images TEXT[],
  helpful_count INTEGER NOT NULL DEFAULT 0 CHECK (helpful_count >= 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(order_id, item_id, user_id)
);

-- Create seller_reviews table
CREATE TABLE public.seller_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(order_id, seller_id, reviewer_id)
);

-- Create review_helpful table
CREATE TABLE public.review_helpful (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.product_reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(review_id, user_id)
);

-- Create shop_conversations table
CREATE TABLE public.shop_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES public.shop_items(id) ON DELETE SET NULL,
  buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CHECK (buyer_id <> seller_id)
);

-- Create shop_messages table
CREATE TABLE public.shop_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.shop_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_shop_items_seller ON public.shop_items(seller_id);
CREATE INDEX idx_shop_items_category ON public.shop_items(category);
CREATE INDEX idx_shop_items_status ON public.shop_items(status);
CREATE INDEX idx_shop_items_created ON public.shop_items(created_at DESC);
CREATE INDEX idx_shop_items_price ON public.shop_items(price);
CREATE INDEX idx_shop_item_likes_item ON public.shop_item_likes(item_id);
CREATE INDEX idx_shop_item_likes_user ON public.shop_item_likes(user_id);
CREATE INDEX idx_shop_item_comments_item ON public.shop_item_comments(item_id);
CREATE INDEX idx_orders_buyer ON public.orders(buyer_id);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);
CREATE INDEX idx_order_items_seller ON public.order_items(seller_id);
CREATE INDEX idx_flash_sales_item ON public.flash_sales(item_id);
CREATE INDEX idx_flash_sales_status ON public.flash_sales(status);
CREATE INDEX idx_group_buys_item ON public.group_buys(item_id);
CREATE INDEX idx_product_reviews_item ON public.product_reviews(item_id);
CREATE INDEX idx_seller_reviews_seller ON public.seller_reviews(seller_id);

-- Enable RLS on all tables
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_item_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_item_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_item_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_item_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flash_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_buys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_buy_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_helpful ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shop_items
CREATE POLICY "Anyone can view active shop items"
  ON public.shop_items FOR SELECT
  USING (status = 'active');

CREATE POLICY "Authenticated users can create shop items"
  ON public.shop_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update own shop items"
  ON public.shop_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete own shop items"
  ON public.shop_items FOR DELETE
  TO authenticated
  USING (auth.uid() = seller_id);

-- RLS Policies for shop_item_stats
CREATE POLICY "Anyone can view shop item stats"
  ON public.shop_item_stats FOR SELECT
  USING (true);

-- RLS Policies for seller_profiles
CREATE POLICY "Anyone can view seller profiles"
  ON public.seller_profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can create own seller profile"
  ON public.seller_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own seller profile"
  ON public.seller_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for seller_stats
CREATE POLICY "Anyone can view seller stats"
  ON public.seller_stats FOR SELECT
  USING (true);

-- RLS Policies for shop_item_likes
CREATE POLICY "Anyone can view shop item likes"
  ON public.shop_item_likes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can like shop items"
  ON public.shop_item_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike shop items"
  ON public.shop_item_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for shop_item_comments
CREATE POLICY "Anyone can view shop item comments"
  ON public.shop_item_comments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can comment on shop items"
  ON public.shop_item_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments"
  ON public.shop_item_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON public.shop_item_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for shop_item_saves
CREATE POLICY "Users can view own saved items"
  ON public.shop_item_saves FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can save shop items"
  ON public.shop_item_saves FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave shop items"
  ON public.shop_item_saves FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for seller_follows
CREATE POLICY "Anyone can view seller follows"
  ON public.seller_follows FOR SELECT
  USING (true);

CREATE POLICY "Users can follow sellers"
  ON public.seller_follows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow sellers"
  ON public.seller_follows FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id);

-- RLS Policies for flash_sales
CREATE POLICY "Anyone can view active flash sales"
  ON public.flash_sales FOR SELECT
  USING (status = 'active' AND now() BETWEEN start_time AND end_time);

CREATE POLICY "Sellers can create flash sales for own items"
  ON public.flash_sales FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.shop_items
    WHERE id = item_id AND seller_id = auth.uid()
  ));

-- RLS Policies for group_buys
CREATE POLICY "Anyone can view active group buys"
  ON public.group_buys FOR SELECT
  USING (status = 'active');

CREATE POLICY "Sellers can create group buys for own items"
  ON public.group_buys FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.shop_items
    WHERE id = item_id AND seller_id = auth.uid()
  ));

-- RLS Policies for group_buy_participants
CREATE POLICY "Anyone can view group buy participants"
  ON public.group_buy_participants FOR SELECT
  USING (true);

CREATE POLICY "Users can join group buys"
  ON public.group_buy_participants FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave group buys"
  ON public.group_buy_participants FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for orders
CREATE POLICY "Buyers can view own orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (auth.uid() = buyer_id);

CREATE POLICY "Sellers can view orders for their items"
  ON public.orders FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.order_items
    WHERE order_id = orders.id AND seller_id = auth.uid()
  ));

CREATE POLICY "Buyers can create orders"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Buyers can update own pending orders"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (auth.uid() = buyer_id AND status = 'pending')
  WITH CHECK (auth.uid() = buyer_id);

-- RLS Policies for order_items
CREATE POLICY "Users can view order items for their orders"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND buyer_id = auth.uid())
    OR auth.uid() = seller_id
  );

-- RLS Policies for shipping_addresses
CREATE POLICY "Users can view own shipping addresses"
  ON public.shipping_addresses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own shipping addresses"
  ON public.shipping_addresses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shipping addresses"
  ON public.shipping_addresses FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own shipping addresses"
  ON public.shipping_addresses FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for payment_methods
CREATE POLICY "Users can view own payment methods"
  ON public.payment_methods FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own payment methods"
  ON public.payment_methods FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payment methods"
  ON public.payment_methods FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own payment methods"
  ON public.payment_methods FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for product_reviews
CREATE POLICY "Anyone can view product reviews"
  ON public.product_reviews FOR SELECT
  USING (true);

CREATE POLICY "Verified buyers can create product reviews"
  ON public.product_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.order_items oi ON o.id = oi.order_id
      WHERE o.id = order_id
        AND o.buyer_id = auth.uid()
        AND oi.item_id = item_id
        AND o.status = 'delivered'
    )
  );

CREATE POLICY "Users can update own product reviews"
  ON public.product_reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for seller_reviews
CREATE POLICY "Anyone can view seller reviews"
  ON public.seller_reviews FOR SELECT
  USING (true);

CREATE POLICY "Buyers can create seller reviews"
  ON public.seller_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = reviewer_id
    AND EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = order_id
        AND buyer_id = auth.uid()
        AND status = 'delivered'
    )
  );

-- RLS Policies for review_helpful
CREATE POLICY "Users can mark reviews helpful"
  ON public.review_helpful FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unmark reviews helpful"
  ON public.review_helpful FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for shop_conversations
CREATE POLICY "Participants can view conversations"
  ON public.shop_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Buyers can create conversations"
  ON public.shop_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = buyer_id);

-- RLS Policies for shop_messages
CREATE POLICY "Participants can view messages"
  ON public.shop_messages FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.shop_conversations
    WHERE id = conversation_id
      AND (buyer_id = auth.uid() OR seller_id = auth.uid())
  ));

CREATE POLICY "Participants can send messages"
  ON public.shop_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.shop_conversations
      WHERE id = conversation_id
        AND (buyer_id = auth.uid() OR seller_id = auth.uid())
    )
  );

-- Database Functions

-- Function to create shop_item_stats when item is created
CREATE OR REPLACE FUNCTION public.create_shop_item_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.shop_item_stats (item_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

-- Function to create seller stats when seller profile is created
CREATE OR REPLACE FUNCTION public.create_seller_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.seller_stats (seller_id)
  VALUES (NEW.user_id);
  RETURN NEW;
END;
$$;

-- Function to update shop item stats on likes
CREATE OR REPLACE FUNCTION public.update_shop_item_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.shop_item_stats
    SET likes_count = likes_count + 1
    WHERE item_id = NEW.item_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.shop_item_stats
    SET likes_count = likes_count - 1
    WHERE item_id = OLD.item_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Function to update shop item stats on comments
CREATE OR REPLACE FUNCTION public.update_shop_item_comments_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.shop_item_stats
    SET comments_count = comments_count + 1
    WHERE item_id = NEW.item_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.shop_item_stats
    SET comments_count = comments_count - 1
    WHERE item_id = OLD.item_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Function to update shop item stats on saves
CREATE OR REPLACE FUNCTION public.update_shop_item_saves_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.shop_item_stats
    SET saves_count = saves_count + 1
    WHERE item_id = NEW.item_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.shop_item_stats
    SET saves_count = saves_count - 1
    WHERE item_id = OLD.item_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Function to update seller followers count
CREATE OR REPLACE FUNCTION public.update_seller_followers_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.seller_stats
    SET followers_count = followers_count + 1
    WHERE seller_id = NEW.seller_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.seller_stats
    SET followers_count = followers_count - 1
    WHERE seller_id = OLD.seller_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Function to update group buy participants count
CREATE OR REPLACE FUNCTION public.update_group_buy_participants_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.group_buys
    SET current_participants = current_participants + 1
    WHERE id = NEW.group_buy_id;
    
    -- Check if goal reached
    UPDATE public.group_buys
    SET status = 'completed'
    WHERE id = NEW.group_buy_id
      AND current_participants >= min_participants
      AND status = 'active';
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.group_buys
    SET current_participants = current_participants - 1
    WHERE id = OLD.group_buy_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Function to update review helpful count
CREATE OR REPLACE FUNCTION public.update_review_helpful_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.product_reviews
    SET helpful_count = helpful_count + 1
    WHERE id = NEW.review_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.product_reviews
    SET helpful_count = helpful_count - 1
    WHERE id = OLD.review_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Function to generate unique order numbers
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  order_num TEXT;
  exists_check INTEGER;
BEGIN
  LOOP
    order_num := 'ORD-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0');
    SELECT COUNT(*) INTO exists_check FROM public.orders WHERE order_number = order_num;
    EXIT WHEN exists_check = 0;
  END LOOP;
  RETURN order_num;
END;
$$;

-- Function to update seller active listings count
CREATE OR REPLACE FUNCTION public.update_seller_active_listings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'active') THEN
    UPDATE public.seller_stats
    SET active_listings = active_listings + 1
    WHERE seller_id = NEW.seller_id;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.status = 'active' AND NEW.status != 'active') THEN
      UPDATE public.seller_stats
      SET active_listings = active_listings - 1
      WHERE seller_id = NEW.seller_id;
    ELSIF (OLD.status != 'active' AND NEW.status = 'active') THEN
      UPDATE public.seller_stats
      SET active_listings = active_listings + 1
      WHERE seller_id = NEW.seller_id;
    END IF;
  ELSIF (TG_OP = 'DELETE' AND OLD.status = 'active') THEN
    UPDATE public.seller_stats
    SET active_listings = active_listings - 1
    WHERE seller_id = OLD.seller_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Create Triggers

CREATE TRIGGER create_shop_item_stats_trigger
  AFTER INSERT ON public.shop_items
  FOR EACH ROW
  EXECUTE FUNCTION public.create_shop_item_stats();

CREATE TRIGGER create_seller_stats_trigger
  AFTER INSERT ON public.seller_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_seller_stats();

CREATE TRIGGER update_shop_item_likes_count_trigger
  AFTER INSERT OR DELETE ON public.shop_item_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_shop_item_likes_count();

CREATE TRIGGER update_shop_item_comments_count_trigger
  AFTER INSERT OR DELETE ON public.shop_item_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_shop_item_comments_count();

CREATE TRIGGER update_shop_item_saves_count_trigger
  AFTER INSERT OR DELETE ON public.shop_item_saves
  FOR EACH ROW
  EXECUTE FUNCTION public.update_shop_item_saves_count();

CREATE TRIGGER update_seller_followers_count_trigger
  AFTER INSERT OR DELETE ON public.seller_follows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_seller_followers_count();

CREATE TRIGGER update_group_buy_participants_count_trigger
  AFTER INSERT OR DELETE ON public.group_buy_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_group_buy_participants_count();

CREATE TRIGGER update_review_helpful_count_trigger
  AFTER INSERT OR DELETE ON public.review_helpful
  FOR EACH ROW
  EXECUTE FUNCTION public.update_review_helpful_count();

CREATE TRIGGER update_seller_active_listings_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.shop_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_seller_active_listings();

CREATE TRIGGER update_shop_items_updated_at
  BEFORE UPDATE ON public.shop_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shop_item_comments_updated_at
  BEFORE UPDATE ON public.shop_item_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_item_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_item_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.flash_sales;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_buys;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_buy_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_messages;