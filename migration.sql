--
-- PostgreSQL database dump
--

\restrict LEkcr7OU9etcvg6kavDYQXNyfAhIys2L4AJ4ciwiG3pJGJN0jA0X2f1Cn1pBHFw

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: card_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.card_category AS ENUM (
    'Personalidad',
    'Salud',
    'Comportamiento',
    'Habilidades',
    'Energía'
);


--
-- Name: contest_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.contest_status AS ENUM (
    'upcoming',
    'active',
    'finished'
);


--
-- Name: contest_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.contest_type AS ENUM (
    'Disfraces',
    'Habilidades',
    'Belleza'
);


--
-- Name: sync_clan_member_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_clan_member_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE clans SET member_count = member_count + 1 WHERE id = NEW.clan_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE clans SET member_count = member_count - 1 WHERE id = OLD.clan_id;
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    requester_pet_id uuid NOT NULL,
    invited_pet_id uuid NOT NULL,
    type character varying(50) DEFAULT 'paseo'::character varying NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    location character varying(200),
    notes text,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: card_paw_votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.card_paw_votes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    card_id uuid NOT NULL,
    pet_id uuid NOT NULL,
    voted_at timestamp with time zone DEFAULT now()
);


--
-- Name: cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cards (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    category public.card_category NOT NULL,
    created_by uuid,
    paw_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: clan_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clan_members (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    clan_id uuid NOT NULL,
    pet_id uuid NOT NULL,
    role character varying(20) DEFAULT 'member'::character varying,
    joined_at timestamp with time zone DEFAULT now(),
    CONSTRAINT clan_members_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'moderator'::character varying, 'member'::character varying])::text[])))
);


--
-- Name: clans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clans (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    avatar_url text,
    cover_url text,
    level integer DEFAULT 1,
    member_count integer DEFAULT 0,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: companion_croquetas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companion_croquetas (
    companion_id uuid NOT NULL,
    balance integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: companions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    username character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    email_verified boolean DEFAULT false NOT NULL,
    verification_token character varying(128),
    verification_token_expires_at timestamp with time zone,
    active_pet_id uuid
);


--
-- Name: contest_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contest_entries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    contest_id uuid NOT NULL,
    pet_id uuid NOT NULL,
    media_url text,
    votes integer DEFAULT 0,
    entered_at timestamp with time zone DEFAULT now()
);


--
-- Name: contests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    type public.contest_type NOT NULL,
    status public.contest_status DEFAULT 'upcoming'::public.contest_status,
    prize_description text,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pet1_id uuid NOT NULL,
    pet2_id uuid NOT NULL,
    last_message_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: croqueta_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.croqueta_transactions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    companion_id uuid NOT NULL,
    amount integer NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: friendships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.friendships (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    pet_id uuid NOT NULL,
    friend_id uuid NOT NULL,
    is_manada boolean DEFAULT false,
    manada_order integer,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT friendships_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'rejected'::character varying])::text[])))
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_pet_id uuid NOT NULL,
    content text NOT NULL,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_as_owner boolean DEFAULT false NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    companion_id uuid NOT NULL,
    type character varying(50) NOT NULL,
    message text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pet_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pet_cards (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    pet_id uuid NOT NULL,
    card_id uuid NOT NULL,
    added_at timestamp with time zone DEFAULT now()
);


--
-- Name: pets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    companion_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    username character varying(50) NOT NULL,
    breed character varying(100),
    species character varying(50) DEFAULT 'Perro'::character varying,
    location character varying(150),
    bio text,
    avatar_url text,
    level integer DEFAULT 1,
    xp integer DEFAULT 0,
    popularity numeric(5,2) DEFAULT 0,
    hydrant_enabled boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: card_paw_votes card_paw_votes_card_id_pet_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.card_paw_votes
    ADD CONSTRAINT card_paw_votes_card_id_pet_id_key UNIQUE (card_id, pet_id);


--
-- Name: card_paw_votes card_paw_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.card_paw_votes
    ADD CONSTRAINT card_paw_votes_pkey PRIMARY KEY (id);


--
-- Name: cards cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cards
    ADD CONSTRAINT cards_pkey PRIMARY KEY (id);


--
-- Name: clan_members clan_members_clan_id_pet_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clan_members
    ADD CONSTRAINT clan_members_clan_id_pet_id_key UNIQUE (clan_id, pet_id);


--
-- Name: clan_members clan_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clan_members
    ADD CONSTRAINT clan_members_pkey PRIMARY KEY (id);


--
-- Name: clans clans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clans
    ADD CONSTRAINT clans_pkey PRIMARY KEY (id);


--
-- Name: companion_croquetas companion_croquetas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companion_croquetas
    ADD CONSTRAINT companion_croquetas_pkey PRIMARY KEY (companion_id);


--
-- Name: companions companions_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companions
    ADD CONSTRAINT companions_email_key UNIQUE (email);


--
-- Name: companions companions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companions
    ADD CONSTRAINT companions_pkey PRIMARY KEY (id);


--
-- Name: companions companions_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companions
    ADD CONSTRAINT companions_username_key UNIQUE (username);


--
-- Name: contest_entries contest_entries_contest_id_pet_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contest_entries
    ADD CONSTRAINT contest_entries_contest_id_pet_id_key UNIQUE (contest_id, pet_id);


--
-- Name: contest_entries contest_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contest_entries
    ADD CONSTRAINT contest_entries_pkey PRIMARY KEY (id);


--
-- Name: contests contests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contests
    ADD CONSTRAINT contests_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: croqueta_transactions croqueta_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.croqueta_transactions
    ADD CONSTRAINT croqueta_transactions_pkey PRIMARY KEY (id);


--
-- Name: friendships friendships_pet_id_friend_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_pet_id_friend_id_key UNIQUE (pet_id, friend_id);


--
-- Name: friendships friendships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: pet_cards pet_cards_pet_id_card_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_cards
    ADD CONSTRAINT pet_cards_pet_id_card_id_key UNIQUE (pet_id, card_id);


--
-- Name: pet_cards pet_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_cards
    ADD CONSTRAINT pet_cards_pkey PRIMARY KEY (id);


--
-- Name: pets pets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pets
    ADD CONSTRAINT pets_pkey PRIMARY KEY (id);


--
-- Name: pets pets_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pets
    ADD CONSTRAINT pets_username_key UNIQUE (username);


--
-- Name: idx_cards_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cards_category ON public.cards USING btree (category);


--
-- Name: idx_clan_members_clan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clan_members_clan ON public.clan_members USING btree (clan_id);


--
-- Name: idx_clan_members_pet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clan_members_pet ON public.clan_members USING btree (pet_id);


--
-- Name: idx_friendships_friend; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friendships_friend ON public.friendships USING btree (friend_id);


--
-- Name: idx_friendships_pet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friendships_pet ON public.friendships USING btree (pet_id);


--
-- Name: idx_pet_cards_pet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pet_cards_pet ON public.pet_cards USING btree (pet_id);


--
-- Name: idx_pets_companion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pets_companion ON public.pets USING btree (companion_id);


--
-- Name: clan_members trg_clan_member_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_clan_member_count AFTER INSERT OR DELETE ON public.clan_members FOR EACH ROW EXECUTE FUNCTION public.sync_clan_member_count();


--
-- Name: companions trg_companions_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_companions_updated BEFORE UPDATE ON public.companions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: pets trg_pets_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pets_updated BEFORE UPDATE ON public.pets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: appointments appointments_invited_pet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_invited_pet_id_fkey FOREIGN KEY (invited_pet_id) REFERENCES public.pets(id) ON DELETE CASCADE;


--
-- Name: appointments appointments_requester_pet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_requester_pet_id_fkey FOREIGN KEY (requester_pet_id) REFERENCES public.pets(id) ON DELETE CASCADE;


--
-- Name: card_paw_votes card_paw_votes_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.card_paw_votes
    ADD CONSTRAINT card_paw_votes_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.cards(id) ON DELETE CASCADE;


--
-- Name: card_paw_votes card_paw_votes_pet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.card_paw_votes
    ADD CONSTRAINT card_paw_votes_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES public.pets(id) ON DELETE CASCADE;


--
-- Name: cards cards_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cards
    ADD CONSTRAINT cards_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.pets(id) ON DELETE SET NULL;


--
-- Name: clan_members clan_members_clan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clan_members
    ADD CONSTRAINT clan_members_clan_id_fkey FOREIGN KEY (clan_id) REFERENCES public.clans(id) ON DELETE CASCADE;


--
-- Name: clan_members clan_members_pet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clan_members
    ADD CONSTRAINT clan_members_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES public.pets(id) ON DELETE CASCADE;


--
-- Name: clans clans_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clans
    ADD CONSTRAINT clans_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.pets(id) ON DELETE SET NULL;


--
-- Name: companion_croquetas companion_croquetas_companion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companion_croquetas
    ADD CONSTRAINT companion_croquetas_companion_id_fkey FOREIGN KEY (companion_id) REFERENCES public.companions(id) ON DELETE CASCADE;


--
-- Name: contest_entries contest_entries_contest_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contest_entries
    ADD CONSTRAINT contest_entries_contest_id_fkey FOREIGN KEY (contest_id) REFERENCES public.contests(id) ON DELETE CASCADE;


--
-- Name: contest_entries contest_entries_pet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contest_entries
    ADD CONSTRAINT contest_entries_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES public.pets(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_pet1_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pet1_id_fkey FOREIGN KEY (pet1_id) REFERENCES public.pets(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_pet2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pet2_id_fkey FOREIGN KEY (pet2_id) REFERENCES public.pets(id) ON DELETE CASCADE;


--
-- Name: croqueta_transactions croqueta_transactions_companion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.croqueta_transactions
    ADD CONSTRAINT croqueta_transactions_companion_id_fkey FOREIGN KEY (companion_id) REFERENCES public.companions(id) ON DELETE CASCADE;


--
-- Name: friendships friendships_friend_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_friend_id_fkey FOREIGN KEY (friend_id) REFERENCES public.pets(id) ON DELETE CASCADE;


--
-- Name: friendships friendships_pet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES public.pets(id) ON DELETE CASCADE;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_pet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_pet_id_fkey FOREIGN KEY (sender_pet_id) REFERENCES public.pets(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_companion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_companion_id_fkey FOREIGN KEY (companion_id) REFERENCES public.companions(id) ON DELETE CASCADE;


--
-- Name: pet_cards pet_cards_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_cards
    ADD CONSTRAINT pet_cards_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.cards(id) ON DELETE CASCADE;


--
-- Name: pet_cards pet_cards_pet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pet_cards
    ADD CONSTRAINT pet_cards_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES public.pets(id) ON DELETE CASCADE;


--
-- Name: pets pets_companion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pets
    ADD CONSTRAINT pets_companion_id_fkey FOREIGN KEY (companion_id) REFERENCES public.companions(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict LEkcr7OU9etcvg6kavDYQXNyfAhIys2L4AJ4ciwiG3pJGJN0jA0X2f1Cn1pBHFw

