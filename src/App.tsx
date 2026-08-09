import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';

import {
  Course,
  EnrollmentRequest,
  UserProfile,
  LeaderboardUser,
  QuizQuestion,
} from './types';

import {
  DEMO_USERS,
  INITIAL_MARKETPLACE_COURSES,
  INITIAL_LEADERBOARD_USERS,
  PUBLISH_CATEGORIES,
  TOPIC_QUIZZES,
} from './data/mockData';

import { isSupabaseConfigured, toFriendlyError } from './lib/supabase';
import {
  changeEmail,
  deleteAccount,
  getSession,
  onAuthStateChange,
  resendVerificationEmail,
  sendPasswordResetEmail,
  signInWithEmail,
  signInWithGoogle,
  signOut as supabaseSignOut,
  signUpWithEmail,
  updatePassword,
  verifyPassword,
} from './services/auth';
import {
  ensureProfile,
  getCurrentUserProfile,
  updateProfile,
  subscribeToProfile,
} from './services/profiles';
import { purchaseCredits } from './services/payments';
import { deleteCourse, listCourses, listTaughtCourses, publishCourse, recordSkillTest } from './services/courses';
import { generateQuiz } from './services/quiz';
import {
  decideEnrollment,
  listInstructorRequests,
  requestEnrollment,
  subscribeToInstructorRequests,
} from './services/enrollments';
import { listLeaderboard } from './services/leaderboard';
import { markAllRead, markRead } from './services/notifications';
import CourseManagePage from './screens/CourseManagePage';
import CourseClassroomPage from './screens/CourseClassroomPage';
import AppShell, { type Screen } from './ui/AppShell';
import { Badge, Button, Card, Modal, ModalHeader } from './ui/primitives';
import HomeScreen from './screens/HomeScreen';
import { LearningScreen, TeachingScreen } from './screens/CourseScreens';
import ExploreSection from './screens/ExploreSection';
import { WalletScreen, type CreditPack } from './screens/WalletScreens';
import LeaderboardScreen from './screens/LeaderboardScreen';
import { AccountSettingsScreen, ProfileScreen, type NotificationPrefs } from './screens/ProfileScreens';
import PublishCoursePage from './screens/PublishCoursePage';
import CourseDetailModal from './screens/CourseDetailModal';
import AuthScreen from './screens/AuthScreen';
import LandingPage from './screens/LandingPage';

const triggerCelebrationConfetti = () => {
  try {
    confetti({
      particleCount: 130,
      spread: 85,
      origin: { y: 0.6 },
      colors: ['#7342E2', '#3B82F6', '#10B981', '#F59E0B', '#EC4899'],
    });
  } catch (e) {
    console.error('Confetti trigger error:', e);
  }
};

const triggerPaymentSuccessConfetti = () => {
  try {
    const count = 180;
    const defaults = { origin: { y: 0.6 } };
    confetti({ ...defaults, particleCount: Math.floor(count * 0.35), spread: 40, startVelocity: 55, colors: ['#F59E0B', '#10B981', '#7342E2'] });
    confetti({ ...defaults, particleCount: Math.floor(count * 0.3), spread: 75, colors: ['#3B82F6', '#F59E0B'] });
    confetti({ ...defaults, particleCount: Math.floor(count * 0.35), spread: 110, decay: 0.92, colors: ['#EC4899', '#7342E2', '#10B981'] });
  } catch (e) {
    console.error(e);
  }
};

import {
  Bell,
  CheckCircle2,
} from 'lucide-react';

export function SkillvoLogo({
  className = 'w-8 h-8',
  fill = '#192837',
}: {
  className?: string;
  fill?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      fill="none"
      overflow="visible"
      viewBox="0 0 256 256"
      className={className}
    >
      <path
        d="M 64 128 L 64.5 128 L 32 95 L 0 64 L 0 0 L 64 0 L 128 64 L 128 64.5 L 161 32 L 192 0 L 256 0 L 256 64 L 192 128 L 128 128 L 128 192 L 96 223 L 63.5 256 L 0 256 L 0 192 Z M 256 192 L 224 223 L 191.5 256 L 128 256 L 128 192 L 192 128 L 256 128 Z"
        fill={fill}
      />
    </svg>
  );
}

// ==========================================
// DATA STRUCTURES & TYPES
// ==========================================

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.12,
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

type AuthMode = 'login' | 'register' | 'forgot' | 'verify' | 'reset';

export default function App() {
  // Global State. The signed-in user comes from Supabase; supabase-js keeps the
  // session in localStorage under 'skillvo.auth' and refreshes it, so there is
  // no separate user cache to keep in step.
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(isSupabaseConfigured);
  const [authedUserId, setAuthedUserId] = useState<string | null>(null);
  const isRecoveringRef = useRef(false);

  /** Pulls the profile, enrollments and notifications for a signed-in user. */
  const loadCurrentUser = React.useCallback(async (userId: string) => {
    try {
      // No-op when the auth.users trigger installed cleanly; provisions the
      // profile on first sign-in when it did not.
      await ensureProfile();
      const profile = await getCurrentUserProfile(userId);
      setCurrentUser(profile);
      return profile;
    } catch (err) {
      console.error('[skillvo] could not load profile', err);
      setCurrentUser(null);
      return null;
    }
  }, []);

  // Restore an existing session on load, then follow sign-in/sign-out.
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let cancelled = false;

    void (async () => {
      try {
        const session = await getSession();
        if (cancelled) return;
        if (session?.user) {
          setAuthedUserId(session.user.id);
          await loadCurrentUser(session.user.id);
        }
      } catch (err) {
        console.error('[skillvo] session restore failed', err);
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    })();

    // Supabase sends users back to /auth/callback (OAuth, email verification)
    // and /auth/reset-password (recovery). detectSessionInUrl has already
    // consumed the code by now, so just show the right screen and tidy the URL.
    const landing = window.location.pathname;
    if (landing.startsWith('/auth/reset-password')) {
      // The recovery link also produces a SIGNED_IN event; this flag stops that
      // handler from closing the form before the new password is set.
      isRecoveringRef.current = true;
      setAuthModalMode('reset');
    }
    if (landing.startsWith('/auth/')) {
      window.history.replaceState({}, '', '/');
    }

    const unsubscribe = onAuthStateChange((session, event) => {
      // Arriving from a password-reset email: Supabase hands us a temporary
      // session and we must show the "set a new password" form, not the portal.
      if (event === 'PASSWORD_RECOVERY') {
        setAuthModalMode('reset');
        return;
      }

      if (session?.user) {
        setAuthedUserId(session.user.id);
        void loadCurrentUser(session.user.id).then((profile) => {
          if (profile && event === 'SIGNED_IN' && !isRecoveringRef.current) {
            setAuthModalMode(null);
            showToast(`Welcome back, ${profile.name}!`);
          }
        });
      } else {
        setAuthedUserId(null);
        setCurrentUser(null);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadCurrentUser]);

  // Wallet balance changes server-side (payments settle in an Edge Function),
  // so mirror profile updates straight into the UI.
  useEffect(() => {
    if (!isSupabaseConfigured || !authedUserId) return;
    return subscribeToProfile(authedUserId, (row) => {
      setCurrentUser((prev) =>
        prev
          ? {
              ...prev,
              credits: row.credits,
              xpPoints: row.xp_points,
              level: row.level,
              levelTitle: row.level_title,
            }
          : prev,
      );
    });
  }, [authedUserId]);
  // With Supabase configured these start empty and fill from the database.
  // The sample catalogue is only for the offline demo — showing it against a
  // real backend meant courses nobody owned, which no teacher could manage and
  // no student could truly enrol in.
  const [marketplaceCourses, setMarketplaceCourses] = useState<Course[]>(
    isSupabaseConfigured ? [] : INITIAL_MARKETPLACE_COURSES,
  );
  const [enrollmentRequests, setEnrollmentRequests] = useState<EnrollmentRequest[]>(
    isSupabaseConfigured
      ? []
      : [
          {
            id: 'req-1',
            courseId: 'course-2',
            courseTitle: 'Advanced AI Systems & Prompt Pipelines',
            studentId: 'user-alex',
            studentName: 'Alex Rivera',
            studentAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            instructorId: 'user-sarah',
            creditFee: 20,
            status: 'pending',
            requestedAt: 'Yesterday',
          },
        ],
  );

  /**
   * Pulls the catalogue and the instructor's request inbox from the database.
   * A teacher's own unpublished drafts are not in `listCourses`, so they are
   * merged in — otherwise a course you just published but un-published would
   * disappear from your own Teaching tab.
   */
  const refreshCourses = React.useCallback(async (userId: string | null) => {
    if (!isSupabaseConfigured) return;
    try {
      const [published, taught, requests] = await Promise.all([
        listCourses(),
        userId ? listTaughtCourses(userId) : Promise.resolve([]),
        userId ? listInstructorRequests(userId) : Promise.resolve([]),
      ]);

      const byId = new Map<string, Course>();
      for (const course of [...published, ...taught]) byId.set(course.id, course);

      setMarketplaceCourses(Array.from(byId.values()));
      setEnrollmentRequests(requests);
    } catch (err) {
      console.error('[skillvo] could not load courses', err);
    }
  }, []);

  useEffect(() => {
    void refreshCourses(authedUserId);
  }, [authedUserId, refreshCourses]);

  // A student's request lands in the teacher's inbox without a reload.
  useEffect(() => {
    if (!isSupabaseConfigured || !authedUserId) return;
    return subscribeToInstructorRequests(authedUserId, () => {
      void refreshCourses(authedUserId);
    });
  }, [authedUserId, refreshCourses]);

  // Auth Modal state
  const [authModalMode, setAuthModalMode] = useState<AuthMode | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [authNotice, setAuthNotice] = useState('');
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState('');

  // Form Inputs
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [departmentInput, setDepartmentInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Main Dashboard Portal state
  const [activePortalTab, setActivePortalTab] = useState<'marketplace' | 'learning' | 'teaching' | 'wallet' | 'leaderboard' | 'profile'>('marketplace');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // A plain document listener rather than a full-screen overlay div — the
  // header uses backdrop-blur, and `backdrop-filter` makes an element a
  // containing block for `fixed` descendants in Chromium/WebKit, which would
  // trap a fixed "click outside to close" overlay inside the header strip.
  useEffect(() => {
    if (!showNotifications) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);
  const [isLeftNavOpen, setIsLeftNavOpen] = useState(false);
  const [leaderboardFilter, setLeaderboardFilter] = useState<'all' | 'teachers' | 'students'>('all');

  // Background Video Loading Screen State
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const bgVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    // Check if video is already cached and loaded
    if (bgVideoRef.current && bgVideoRef.current.readyState >= 3) {
      setIsVideoLoaded(true);
    }
    // Safety fallback timeout so user is never stuck on loading screen
    const timer = setTimeout(() => {
      setIsVideoLoaded(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Course Publishing & Skill Test (full-page flow)
  const [publishStep, setPublishStep] = useState<'details' | 'quiz' | 'success'>('details');
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseCategory, setNewCourseCategory] = useState('Engineering');
  const [newCourseDesc, setNewCourseDesc] = useState('');
  const [newCourseFee, setNewCourseFee] = useState(15);

  // Buy Credits Modal & Payment simulation
  const [selectedCreditPackage, setSelectedCreditPackage] = useState<{ credits: number; priceRupees: number; packName: string; popular?: boolean } | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Celebration Overlay States
  const [paymentSuccessCelebration, setPaymentSuccessCelebration] = useState<{
    credits: number;
    priceRupees: number;
    packName: string;
    updatedCredits: number;
  } | null>(null);

  /**
   * Razorpay credit purchase.
   *
   * The browser never decides how many credits were bought: it names a pack,
   * the Edge Function looks up the price server-side, and the wallet is only
   * topped up after the payment signature is verified.
   */
  const handleConfirmBuyCredits = async () => {
    if (!selectedCreditPackage || !currentUser) return;

    const { credits, priceRupees, packName } = selectedCreditPackage;

    if (!isSupabaseConfigured) {
      showToast('Payments need Supabase credentials in .env.local.');
      return;
    }

    setIsProcessingPayment(true);
    try {
      const result = await purchaseCredits(
        { packName, credits, priceRupees },
        { name: currentUser.name, email: currentUser.email },
      );

      // The realtime profile subscription also carries the new balance, but
      // set it here too so the celebration modal is never a frame behind.
      setCurrentUser((prev) => (prev ? { ...prev, credits: result.newBalance } : prev));
      setSelectedCreditPackage(null);

      triggerPaymentSuccessConfetti();
      setPaymentSuccessCelebration({
        credits: result.credits,
        priceRupees,
        packName,
        updatedCredits: result.newBalance,
      });
      showToast(`🎉 ₹${priceRupees} payment successful! +${result.credits} Credits added to your wallet.`);

      if (authedUserId) void loadCurrentUser(authedUserId);
    } catch (err) {
      const message = toFriendlyError(err);
      // Dismissing the Razorpay modal is a normal action, not an error state.
      showToast(message === 'Payment cancelled.' ? 'Payment cancelled.' : `Payment failed: ${message}`);
    } finally {
      setIsProcessingPayment(false);
    }
  };
  
  // Teacher Quiz State
  const [currentQuizAnswers, setCurrentQuizAnswers] = useState<Record<number, number>>({});
  const [quizScore, setQuizScore] = useState<number | null>(null);
  // AI-generated quiz for the course just being published (Groq, via the
  // generate-quiz edge function). Falls back to the static bank below when
  // generation isn't available or fails.
  const [aiQuiz, setAiQuiz] = useState<QuizQuestion[] | null>(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);

  // The quiz bank holds a different number of questions per category, so the
  // "answered everything" gate and the pass mark are both derived from the
  // list actually rendered. Hardcoding 3 left every category with a shorter
  // quiz — currently all of them — unable to ever enable the publish button.
  const activeQuiz = aiQuiz ?? TOPIC_QUIZZES[newCourseCategory] ?? TOPIC_QUIZZES.Engineering;
  const quizPassMark = Math.max(1, Math.ceil((activeQuiz.length * 2) / 3));
  const quizAnsweredCount = Object.keys(currentQuizAnswers).length;

  // Course content: the teacher's manager and the student's classroom, each
  // opened for one course at a time.
  const [managingCourse, setManagingCourse] = useState<Course | null>(null);
  const [classroomCourse, setClassroomCourse] = useState<Course | null>(null);

  // Toast Notification
  const [activeToast, setActiveToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setActiveToast(message);
    setTimeout(() => {
      setActiveToast(null);
    }, 3500);
  };

  // Direct login or register user
  const handleOpenAuth = (mode: AuthMode, defaultUserKey?: 'alex' | 'sarah') => {
    setAuthModalMode(mode);
    setAuthError('');
    setAuthNotice('');
    if (mode === 'login' && defaultUserKey) {
      setEmailInput(DEMO_USERS[defaultUserKey].email);
      setPasswordInput('password123');
    } else if (mode !== 'forgot') {
      setNameInput('');
      setEmailInput('');
      setPasswordInput('');
      setDepartmentInput('');
    }
  };

  const handleDirectDemoLogin = (userKey: 'alex' | 'sarah') => {
    // The demo identities exist only for the offline walkthrough. Against a
    // real backend they carry no auth session, so every RPC would fail and the
    // portal would show an empty catalogue that belongs to nobody.
    if (isSupabaseConfigured) {
      showToast('Demo accounts are offline-only. Please sign in to use your Skillvo account.');
      setAuthModalMode('login');
      return;
    }

    const user = DEMO_USERS[userKey];
    setCurrentUser(user);
    setAuthModalMode(null);
    setIsMobileMenuOpen(false);
    showToast(`Logged in as ${user.name}! ${user.credits} Skillvo Credits available.`);
  };

  /**
   * Real Supabase auth. Sign-in does not set `currentUser` directly — the
   * SIGNED_IN event from `onAuthStateChange` loads the profile and closes the
   * modal, so a session restored on reload and a fresh sign-in take the exact
   * same path.
   */
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthNotice('');

    if (!isSupabaseConfigured) {
      handleLegacyMockAuth();
      return;
    }

    setIsAuthSubmitting(true);
    try {
      if (authModalMode === 'login') {
        await signInWithEmail(emailInput, passwordInput);
        // SIGNED_IN handler takes over from here.
      } else if (authModalMode === 'register') {
        const { needsEmailVerification } = await signUpWithEmail({
          email: emailInput,
          password: passwordInput,
          name: nameInput,
          department: departmentInput,
        });
        if (needsEmailVerification) {
          setPendingVerifyEmail(emailInput.trim());
          setAuthModalMode('verify');
        }
      } else if (authModalMode === 'forgot') {
        await sendPasswordResetEmail(emailInput);
        setAuthNotice(
          `If an account exists for ${emailInput.trim()}, a reset link is on its way. Check your inbox and spam folder.`,
        );
      } else if (authModalMode === 'reset') {
        if (passwordInput.length < 8) {
          setAuthError('Choose a password of at least 8 characters.');
          return;
        }
        await updatePassword(passwordInput);
        isRecoveringRef.current = false;
        setAuthModalMode(null);
        setPasswordInput('');
        showToast('🔐 Password updated. You are signed in.');
        // Drop the recovery token from the address bar.
        window.history.replaceState({}, '', '/');
      }
    } catch (err) {
      setAuthError(toFriendlyError(err));
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    setAuthError('');
    setIsAuthSubmitting(true);
    try {
      await resendVerificationEmail(pendingVerifyEmail);
      setAuthNotice('Verification email sent again.');
    } catch (err) {
      setAuthError(toFriendlyError(err));
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  /** Offline/demo path, used only when Supabase credentials are absent. */
  const handleLegacyMockAuth = () => {
    if (authModalMode === 'login') {
      const matched = Object.values(DEMO_USERS).find(u => u.email.toLowerCase() === emailInput.trim().toLowerCase());
      if (matched) {
        setCurrentUser(matched);
        setAuthModalMode(null);
        showToast(`Welcome back, ${matched.name}!`);
      } else if (emailInput.trim()) {
        // Log in as new user with 50 credits
        const newUser: UserProfile = {
          id: `user-${Date.now()}`,
          email: emailInput,
          name: emailInput.split('@')[0],
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          department: 'Skillvo Community',
          credits: 50,
          title: 'Skillvo Learner & Teacher',
          joinedDate: 'Just now',
          level: 1,
          levelTitle: 'Level 1 Rising Scholar',
          xpPoints: 100,
          teachingXp: 0,
          learningXp: 100,
          role: 'Student',
          bio: 'Passionate Skillvo community member learning and teaching digital skills.',
          enrolledCourses: [],
          notifications: [
            {
              id: `n-${Date.now()}`,
              message: '🎁 Welcome bonus: 50 Free Skillvo Credits added to your account wallet!',
              time: 'Just now',
              unread: true,
              type: 'credit_added',
            }
          ]
        };
        setCurrentUser(newUser);
        setAuthModalMode(null);
        showToast(`Welcome to Skillvo, ${newUser.name}! 50 Free Credits added!`);
      }
    } else {
      // Registration Flow (ALWAYS gets 50 Credits!)
      const newUser: UserProfile = {
        id: `user-${Date.now()}`,
        email: emailInput || `${nameInput.toLowerCase().replace(/\s+/g, '')}@skillvo.com`,
        name: nameInput || 'New Learner & Teacher',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        department: departmentInput || 'Software Engineering',
        credits: 50, // CRITICAL USER REQUIREMENT: 50 Credits on 1st Registration!
        title: 'Skillvo Educator & Student',
        joinedDate: 'Just now',
        level: 1,
        levelTitle: 'Level 1 Rising Scholar',
        xpPoints: 100,
        teachingXp: 0,
        learningXp: 100,
        role: 'Student',
        bio: 'Passionate Skillvo community member learning and teaching digital skills.',
        enrolledCourses: [],
        notifications: [
          {
            id: `n-${Date.now()}`,
            message: '🎁 Welcome bonus: 50 Free Skillvo Credits added to your account wallet!',
            time: 'Just now',
            unread: true,
            type: 'credit_added',
          }
        ]
      };

      setCurrentUser(newUser);
      setAuthModalMode(null);
      showToast(`🎉 Registration complete! 50 Skillvo Credits added to your account.`);
    }
  };

  /**
   * PROFILE SAVE HANDLER — takes the edited fields directly from the caller
   * rather than reading them back off state. `ProfileScreen` used to funnel
   * its patch through `setEditProfileName`/etc. and call this in the same
   * tick; since state setters don't take effect until the next render, that
   * always saved the *previous* values (name/bio/avatar) and never touched
   * `title` (specialization) at all — it was never wired to any setter.
   */
  const handleSaveProfile = async (patch: { name: string; title: string; bio: string; avatar: string }) => {
    if (!currentUser) return;

    const updatedUser: UserProfile = {
      ...currentUser,
      name: patch.name.trim() || currentUser.name,
      title: patch.title.trim() || currentUser.title,
      avatar: patch.avatar.trim() || currentUser.avatar,
      bio: patch.bio.trim(),
    };

    // Optimistic: the form fields are all free text with no server validation.
    setCurrentUser(updatedUser);

    if (!isSupabaseConfigured || !authedUserId) {
      showToast('✨ Profile details updated successfully!');
      return;
    }

    try {
      await updateProfile(authedUserId, {
        name: updatedUser.name,
        title: updatedUser.title,
        avatar_url: updatedUser.avatar,
        bio: updatedUser.bio ?? '',
      });
      showToast('✨ Profile details updated successfully!');
    } catch (err) {
      showToast(toFriendlyError(err));
      void loadCurrentUser(authedUserId);
    }
  };

  // ENROLL IN COURSE WORKFLOW (Sends enrollment request to teacher; credits deducted upon course completion)
  const handleEnrollInCourse = (course: Course) => {
    if (!currentUser) {
      handleOpenAuth('register');
      return;
    }

    // Check if already enrolled or requested
    const existing = currentUser.enrolledCourses.find(c => c.courseId === course.id);
    if (existing) {
      if (existing.status === 'pending') {
        showToast(`Enrollment request is already pending teacher approval for "${course.title}".`);
      } else if (existing.status === 'completed') {
        showToast(`You have already completed "${course.title}".`);
      } else {
        showToast(`You are already enrolled in "${course.title}".`);
      }
      return;
    }

    // Check if user is the course instructor
    if (course.instructorId === currentUser.id) {
      showToast(`You are the teacher of this course!`);
      return;
    }

    // Inform user of course fee required upon completion
    if (currentUser.credits < course.creditFee) {
      showToast(`Note: Course completion requires ${course.creditFee} credits. (Your current balance: ${currentUser.credits} credits).`);
    }

    // Server-backed path: request_enrollment debits, creates the row and
    // notifies the instructor in one transaction, so the local state below is
    // replaced by whatever the database actually recorded.
    if (isSupabaseConfigured && authedUserId) {
      void (async () => {
        try {
          await requestEnrollment(course.id);
          await loadCurrentUser(authedUserId);
          await refreshCourses(authedUserId);
          showToast(`Enrollment request sent to ${course.instructorName}!`);
        } catch (err) {
          showToast(toFriendlyError(err));
        }
      })();
      return;
    }

    // Add to student's enrolled courses with 'pending' status WITHOUT deducting credits yet
    const updatedUser: UserProfile = {
      ...currentUser,
      enrolledCourses: [
        ...currentUser.enrolledCourses,
        {
          courseId: course.id,
          status: 'pending',
          progress: 0,
          nextLesson: 'Awaiting Teacher Approval',
          requestedAt: 'Just now',
        }
      ],
      notifications: [
        {
          id: `n-${Date.now()}`,
          message: `Requested enrollment in "${course.title}". ${course.creditFee} Skillvo Credits will be deducted upon course completion.`,
          time: 'Just now',
          unread: true,
          type: 'enrollment_request',
        },
        ...currentUser.notifications,
      ]
    };

    setCurrentUser(updatedUser);

    // Create Enrollment Request for Teacher Notification System
    const newRequest: EnrollmentRequest = {
      id: `req-${Date.now()}`,
      courseId: course.id,
      courseTitle: course.title,
      studentId: currentUser.id,
      studentName: currentUser.name,
      studentAvatar: currentUser.avatar,
      instructorId: course.instructorId,
      creditFee: course.creditFee,
      status: 'pending',
      requestedAt: 'Just now',
    };

    setEnrollmentRequests(prev => [newRequest, ...prev]);

    showToast(`Enrollment request sent to ${course.instructorName}! ${course.creditFee} credits will be deducted when course is completed.`);
  };


  // TEACHER APPROVAL / DECLINE WORKFLOW
  const handleTeacherAction = (requestId: string, action: 'approve' | 'decline') => {
    const req = enrollmentRequests.find(r => r.id === requestId);
    if (!req) return;

    // decide_enrollment refunds the student on decline and awards the
    // instructor XP on approval — the instructor's credit payout now happens
    // in complete_enrollment, once the student actually finishes the course,
    // not just on approval.
    if (isSupabaseConfigured && authedUserId) {
      void (async () => {
        try {
          await decideEnrollment(requestId, action === 'approve');
          await loadCurrentUser(authedUserId);
          await refreshCourses(authedUserId);
          showToast(
            action === 'approve'
              ? `Approved ${req.studentName}'s enrollment! You'll earn +${req.creditFee} credits once they complete the course.`
              : 'Declined enrollment request.',
          );
        } catch (err) {
          showToast(toFriendlyError(err));
        }
      })();
      return;
    }

    // Update Request
    setEnrollmentRequests(prev =>
      prev.map(r => r.id === requestId ? { ...r, status: action === 'approve' ? 'approved' : 'declined' } : r)
    );

    // Update marketplace student count if approved
    if (action === 'approve') {
      setMarketplaceCourses(prev =>
        prev.map(c => c.id === req.courseId ? { ...c, studentsCount: c.studentsCount + 1 } : c)
      );
    }

    showToast(
      action === 'approve'
        ? `Approved ${req.studentName}'s enrollment! You'll earn +${req.creditFee} credits once they complete the course.`
        : `Declined enrollment request.`
    );
  };

  // START PUBLISHING COURSE & TEACHER KNOWLEDGE TEST
  const handleStartPublishCourse = () => {
    setPublishStep('details');
    setNewCourseTitle('');
    setNewCourseCategory('Engineering');
    setNewCourseDesc('');
    setNewCourseFee(15);
    setCurrentQuizAnswers({});
    setQuizScore(null);
    setAiQuiz(null);
    setScreen('publish');
  };

  const handleProceedToSkillTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseTitle.trim()) return;

    setCurrentQuizAnswers({});
    setAiQuiz(null);

    if (isSupabaseConfigured) {
      setIsGeneratingQuiz(true);
      try {
        const questions = await generateQuiz({
          title: newCourseTitle,
          category: newCourseCategory,
          description: newCourseDesc,
        });
        setAiQuiz(questions);
      } catch (err) {
        console.error('[skillvo] AI quiz generation failed, falling back to the standard test', err);
        showToast('Could not generate an AI quiz — using the standard skill test instead.');
      } finally {
        setIsGeneratingQuiz(false);
      }
    }

    setPublishStep('quiz');
  };

  const handleQuizAnswerSelect = (qIndex: number, optionIndex: number) => {
    setCurrentQuizAnswers(prev => ({ ...prev, [qIndex]: optionIndex }));
  };

  const handleSubmitSkillQuiz = () => {
    let correct = 0;
    activeQuiz.forEach((q, idx) => {
      if (currentQuizAnswers[idx] === q.correctAnswer) {
        correct += 1;
      }
    });

    setQuizScore(correct);

    if (correct >= quizPassMark) {
      // Teacher PASSED Skill Verification! Publish Course
      if (!currentUser) return;

      // Server-backed publish. The skill-test attempt is logged too, so
      // verified_teacher_topic reflects a result the server recorded rather
      // than a claim from the browser.
      if (isSupabaseConfigured && authedUserId) {
        void (async () => {
          try {
            await recordSkillTest(newCourseCategory, correct, activeQuiz.length);
            await publishCourse(authedUserId, {
              title: newCourseTitle,
              category: newCourseCategory,
              description:
                newCourseDesc ||
                'Hands-on practical curriculum with interactive exercises and teacher guidance.',
              creditFee: newCourseFee,
              lessonsCount: 12,
              level: 'Intermediate',
              verifiedTeacherTopic: true,
            });
            await refreshCourses(authedUserId);
            await loadCurrentUser(authedUserId);
            setPublishStep('success');
            triggerCelebrationConfetti();
            showToast(`Verified & Published "${newCourseTitle}"!`);
          } catch (err) {
            showToast(toFriendlyError(err));
          }
        })();
        return;
      }

      const newCourse: Course = {
        id: `course-${Date.now()}`,
        title: newCourseTitle,
        category: newCourseCategory,
        description: newCourseDesc || 'Hands-on practical curriculum with interactive exercises and teacher guidance.',
        instructorId: currentUser.id,
        instructorName: currentUser.name,
        instructorAvatar: currentUser.avatar,
        creditFee: newCourseFee,
        studentsCount: 0,
        verifiedTeacherTopic: true,
        lessonsCount: 12,
        rating: '5.0',
        level: 'Intermediate',
      };

      setMarketplaceCourses(prev => [newCourse, ...prev]);
      setPublishStep('success');
      triggerCelebrationConfetti();

      // Add notification for teacher
      setCurrentUser(prev => prev ? {
        ...prev,
        notifications: [
          {
            id: `n-${Date.now()}`,
            message: `✨ Skill Verification Passed! Course "${newCourseTitle}" is now live on Skillvo Marketplace.`,
            time: 'Just now',
            unread: true,
            type: 'course_published',
          },
          ...prev.notifications
        ]
      } : null);

      showToast(`Verified & Published "${newCourseTitle}"!`);
    } else {
      showToast(
        `Skill test failed (${correct}/${activeQuiz.length}, need ${quizPassMark}). ` +
          'Review the topic materials and try again.',
      );
    }
  };

  const handleSignOut = async () => {
    if (isSupabaseConfigured) {
      try {
        await supabaseSignOut();
      } catch (err) {
        console.error('[skillvo] sign out failed', err);
      }
    }
    setCurrentUser(null);
    setAuthedUserId(null);
    showToast(`Signed out from Skillvo.`);
  };

  const handleDeleteAccount = async () => {
    if (!currentUser) return;
    const confirmed = window.confirm(
      'Delete your account? This permanently removes your credits, courses, and progress. This cannot be undone.',
    );
    if (!confirmed) return;

    setIsDeletingAccount(true);
    try {
      if (isSupabaseConfigured) {
        await deleteAccount();
      }
      setCurrentUser(null);
      setAuthedUserId(null);
      showToast('Your account has been deleted.');
    } catch (err) {
      showToast(toFriendlyError(err));
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleGoogleOAuthSignIn = async () => {
    if (!isSupabaseConfigured) {
      showToast('Google sign-in needs Supabase credentials in .env.local.');
      return;
    }
    setAuthError('');
    try {
      showToast('🔒 Redirecting to Google...');
      // Redirects away; the session lands back on /auth/callback and the
      // SIGNED_IN handler finishes the job.
      await signInWithGoogle();
    } catch (err) {
      setAuthError(toFriendlyError(err));
    }
  };

  // Filtered courses for Marketplace — a teacher's own courses belong in
  // "Courses I'm Teaching", not in the catalogue they'd be browsing to enroll.
  const filteredCourses = marketplaceCourses.filter(course => {
    const matchesCategory = selectedCategory === 'All' || course.category === selectedCategory;
    const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          course.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          course.instructorName.toLowerCase().includes(searchQuery.toLowerCase());
    const isOwnCourse = currentUser && course.instructorId === currentUser.id;
    return matchesCategory && matchesSearch && !isOwnCourse;
  });

  // Requests targeted to current logged in user (as teacher)
  const myTeacherRequests = enrollmentRequests.filter(r => currentUser && r.instructorId === currentUser.id && r.status === 'pending');
  const myTaughtCourses = marketplaceCourses.filter(c => currentUser && c.instructorId === currentUser.id);

  // Leaderboard: server-ranked when Supabase is configured (each tab ranks on
  // the XP that tab is about), mock data only for the offline demo.
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardUser[]>(
    isSupabaseConfigured ? [] : INITIAL_LEADERBOARD_USERS,
  );

  useEffect(() => {
    if (!isSupabaseConfigured || !authedUserId) return;
    let cancelled = false;
    void listLeaderboard(leaderboardFilter)
      .then((rows) => {
        if (!cancelled) setLeaderboardEntries(rows);
      })
      .catch((err) => console.error('[skillvo] leaderboard load failed', err));
    return () => {
      cancelled = true;
    };
  }, [authedUserId, leaderboardFilter]);


  // Which screen the redesigned portal is showing.
  const [screen, setScreen] = useState<Screen>('home');

  // Notification preferences are a device-local setting for now — there is no
  // column for them on profiles yet.
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>(() => {
    try {
      const saved = localStorage.getItem('skillvo.notificationPrefs');
      if (saved) return JSON.parse(saved) as NotificationPrefs;
    } catch {
      /* ignore unreadable storage */
    }
    return { enrollment: true, sessions: true, material: true };
  });

  useEffect(() => {
    try {
      localStorage.setItem('skillvo.notificationPrefs', JSON.stringify(notificationPrefs));
    } catch {
      /* storage may be unavailable in private mode */
    }
  }, [notificationPrefs]);

  // Course shown in the detail sheet before enrolling.
  const [detailCourse, setDetailCourse] = useState<Course | null>(null);

  // =========================================================================
  // AUTH (full page in the approved design, not a modal over the landing page)
  // =========================================================================
  // Checked ahead of the logged-in portal: a password-recovery link signs the
  // user in under the hood (Supabase issues a temporary session), and without
  // this the portal below would render instead of holding on the "choose a
  // new password" form.
  if (authModalMode) {
    return (
      <AuthScreen
        mode={authModalMode}
        onModeChange={(next) => {
          setAuthNotice('');
          setAuthError('');
          setAuthModalMode(next);
        }}
        email={emailInput}
        onEmailChange={setEmailInput}
        password={passwordInput}
        onPasswordChange={(value) => {
          setPasswordInput(value);
          setAuthError('');
        }}
        name={nameInput}
        onNameChange={setNameInput}
        passwordError={
          authModalMode === 'login' || authModalMode === 'reset' ? authError || undefined : undefined
        }
        notice={authNotice || undefined}
        isSubmitting={isAuthSubmitting}
        onSubmit={() => void handleAuthSubmit({ preventDefault: () => {} } as React.FormEvent)}
        onGoogle={() => void signInWithGoogle()}
        onResendVerification={() => {
          void resendVerificationEmail(pendingVerifyEmail || emailInput)
            .then(() => setAuthNotice('Verification email sent again — check your inbox.'))
            .catch((err) => setAuthNotice(toFriendlyError(err)));
        }}
      />
    );
  }

  // =========================================================================
  // LOGGED-IN PORTAL INTERFACE (TEACH + LEARN UNIFIED PLATFORM)
  // =========================================================================
  // Course Manage is a full page in the approved design, not an overlay.
  if (currentUser && managingCourse) {
    return (
      <CourseManagePage
        course={managingCourse}
        instructorId={currentUser.id}
        notifications={currentUser.notifications}
        onBack={() => setManagingCourse(null)}
        onNotificationsChange={() => void loadCurrentUser(currentUser.id)}
        onDeleteCourse={async () => {
          await deleteCourse(managingCourse.id);
          setManagingCourse(null);
          await refreshCourses(currentUser.id);
        }}
        showToast={showToast}
      />
    );
  }

  // Student classroom mirrors Course Manage: a full page, not an overlay.
  if (currentUser && classroomCourse) {
    return (
      <CourseClassroomPage course={classroomCourse} onBack={() => setClassroomCourse(null)} showToast={showToast} />
    );
  }

  if (currentUser) {
    const unreadCount = currentUser.notifications.filter((n) => n.unread).length;
    const coursesTaught = marketplaceCourses.filter((c) => c.instructorId === currentUser.id).length;
    const coursesCompleted = currentUser.enrolledCourses.filter((c) => c.status === 'completed').length;

    const overlays = (
      <>
          {/* ---------------------------------------------------------- modals */}

          {detailCourse && (
            <CourseDetailModal
              course={detailCourse}
              user={currentUser}
              enrolled={currentUser.enrolledCourses.find((e) => e.courseId === detailCourse.id)}
              onEnroll={(course) => {
                setDetailCourse(null);
                handleEnrollInCourse(course);
              }}
              onOpenClassroom={(course) => {
                setDetailCourse(null);
                setClassroomCourse(course);
              }}
              onManage={(course) => {
                setDetailCourse(null);
                setManagingCourse(course);
              }}
              onClose={() => setDetailCourse(null)}
            />
          )}

          {selectedCreditPackage && (
            <Modal
              onClose={() => !isProcessingPayment && setSelectedCreditPackage(null)}
              maxWidth="max-w-md"
              dismissable={!isProcessingPayment}
            >
              <ModalHeader
                title={selectedCreditPackage.packName}
                subtitle={`${selectedCreditPackage.credits} Skillvo credits`}
                onClose={() => !isProcessingPayment && setSelectedCreditPackage(null)}
                badge={<Badge tone="sand">Order summary</Badge>}
              />
              <div className="p-7 pt-5">
                <div className="flex items-baseline justify-between py-4 border-y border-mint">
                  <span className="text-sm text-slate">Total payable</span>
                  <span className="font-heading font-bold text-3xl">
                    ₹{selectedCreditPackage.priceRupees}
                  </span>
                </div>
                <Button
                  full
                  className="mt-6"
                  disabled={isProcessingPayment}
                  onClick={handleConfirmBuyCredits}
                >
                  {isProcessingPayment ? 'Opening Razorpay…' : 'Pay securely with Razorpay'}
                </Button>
                <p className="text-xs text-slate text-center mt-3 mb-0">
                  Card and UPI details are collected by Razorpay, never by Skillvo.
                </p>
              </div>
            </Modal>
          )}

          {paymentSuccessCelebration && (
            <Modal onClose={() => setPaymentSuccessCelebration(null)} maxWidth="max-w-md">
              <div className="p-10 text-center">
                <div className="w-20 h-20 rounded-full bg-mint flex items-center justify-center text-4xl mx-auto mb-5">
                  💳
                </div>
                <h3 className="font-heading font-bold text-2xl m-0">Payment successful</h3>
                <p className="text-[15px] text-slate mt-3 mb-7">
                  +{paymentSuccessCelebration.credits} credits added to your wallet.
                </p>
                <Button onClick={() => setPaymentSuccessCelebration(null)}>Done</Button>
              </div>
            </Modal>
          )}

          {activeToast && (
            <div className="fixed bottom-6 right-6 z-[60] bg-pine text-white px-5 py-3.5 rounded-[14px] shadow-[0_20px_44px_rgba(11,43,38,.4)] flex items-center gap-3 animate-rise max-w-sm">
              <CheckCircle2 className="w-5 h-5 text-mint shrink-0" />
              <span className="text-sm">{activeToast}</span>
            </div>
          )}
      </>
    );

    // Wallet, Buy Credits, Leaderboard, Profile and Settings carry their own
    // back-link header in the approved design, so they render outside AppShell.
    const SUBPAGES: Screen[] = ['wallet', 'leaderboard', 'profile', 'settings', 'publish'];
    if (SUBPAGES.includes(screen)) {
      return (
        <>
          {screen === 'publish' && (
            <PublishCoursePage
              step={publishStep}
              draft={{
                title: newCourseTitle,
                category: newCourseCategory,
                description: newCourseDesc,
                creditFee: newCourseFee,
              }}
              onDraftChange={(patch) => {
                if (patch.title !== undefined) setNewCourseTitle(patch.title);
                if (patch.category !== undefined) setNewCourseCategory(patch.category);
                if (patch.description !== undefined) setNewCourseDesc(patch.description);
                if (patch.creditFee !== undefined) setNewCourseFee(patch.creditFee);
              }}
              categories={PUBLISH_CATEGORIES}
              quiz={activeQuiz}
              answers={currentQuizAnswers}
              onAnswer={handleQuizAnswerSelect}
              onContinue={() => handleProceedToSkillTest({ preventDefault: () => {} } as React.FormEvent)}
              onBack={() => setPublishStep('details')}
              onSubmitQuiz={handleSubmitSkillQuiz}
              onExit={() => setScreen('teaching')}
              isSubmitting={false}
              isGeneratingQuiz={isGeneratingQuiz}
            />
          )}

          {screen === 'wallet' && (
            <WalletScreen
              user={currentUser}
              onSelectPack={(pack: CreditPack) => setSelectedCreditPackage(pack)}
              isProcessingPayment={isProcessingPayment}
              onBack={() => setScreen('explore')}
            />
          )}

          {screen === 'leaderboard' && (
            <LeaderboardScreen
              user={currentUser}
              entries={leaderboardEntries}
              filter={leaderboardFilter}
              onFilterChange={setLeaderboardFilter}
              onBack={() => setScreen('explore')}
            />
          )}

          {screen === 'profile' && (
            <ProfileScreen
              user={currentUser}
              courses={marketplaceCourses}
              rank={leaderboardEntries.findIndex((e) => e.id === currentUser.id) + 1 || null}
              onSaveProfile={(patch) => void handleSaveProfile(patch)}
              onOpenSettings={() => setScreen('settings')}
              onSignOut={handleSignOut}
              onBack={() => setScreen('explore')}
            />
          )}

          {screen === 'settings' && (
            <AccountSettingsScreen
              user={currentUser}
              prefs={notificationPrefs}
              onPrefsChange={setNotificationPrefs}
              isSaving={false}
              onSave={async ({ email, newPassword }) => {
                try {
                  if (email !== currentUser.email) {
                    await changeEmail(email);
                    showToast(`Confirm the change at ${email} to finish updating your email.`);
                  }
                  if (newPassword) {
                    await updatePassword(newPassword);
                    showToast('Password updated.');
                  }
                  if (email === currentUser.email && !newPassword) {
                    showToast('Notification preferences saved.');
                  }
                } catch (err) {
                  showToast(toFriendlyError(err));
                }
              }}
              onVerifyPassword={(password) => verifyPassword(currentUser.email, password)}
              onDeleteAccount={() => void handleDeleteAccount()}
              isDeletingAccount={isDeletingAccount}
              onBack={() => setScreen('profile')}
            />
          )}

          {overlays}
        </>
      );
    }

    return (
      <AppShell
        user={currentUser}
        screen={screen}
        onNavigate={setScreen}
        onPublishCourse={handleStartPublishCourse}
        onSignOut={handleSignOut}
        notificationsSlot={
          <div className="relative" ref={notificationsRef}>
            <button
              type="button"
              onClick={() => setShowNotifications((open) => !open)}
              aria-label="Notifications"
              className="w-9.5 h-9.5 rounded-[10px] border border-sage bg-white cursor-pointer flex items-center justify-center hover:bg-mint transition-colors relative"
            >
              <Bell className="w-4 h-4 text-ink" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-clay text-white text-[10px] font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
                <div className="absolute right-0 top-12 z-50 w-[320px] bg-white border border-sage rounded-[18px] shadow-[0_20px_50px_rgba(5,31,32,.18)] p-3 animate-pop">
                  <div className="flex items-center justify-between px-2 py-2">
                    <span className="font-heading font-bold text-[11px] tracking-[.1em] uppercase text-slate">
                      Notifications
                    </span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await markAllRead(currentUser.id);
                            await loadCurrentUser(currentUser.id);
                          } catch (err) {
                            showToast(toFriendlyError(err));
                          }
                        }}
                        className="font-heading font-bold text-xs text-moss bg-transparent border-0 cursor-pointer hover:underline"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                  {currentUser.notifications.length === 0 ? (
                    <p className="text-sm text-slate text-center py-6 m-0">Nothing new.</p>
                  ) : (
                    <div className="max-h-[340px] overflow-y-auto">
                      {currentUser.notifications.slice(0, 12).map((note) => (
                        <div
                          key={note.id}
                          className={`flex items-start justify-between gap-2.5 px-3 py-3 rounded-xl text-sm ${
                            note.unread ? 'bg-mint/60' : ''
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-ink leading-snug">{note.message}</div>
                            <div className="text-[11px] text-slate mt-1">{note.time}</div>
                          </div>
                          {note.unread && (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await markRead(note.id);
                                  await loadCurrentUser(currentUser.id);
                                } catch (err) {
                                  showToast(toFriendlyError(err));
                                }
                              }}
                              className="font-heading font-bold text-[11px] text-moss bg-transparent border-0 cursor-pointer shrink-0 whitespace-nowrap hover:underline"
                            >
                              Mark as read
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
            )}
          </div>
        }
      >
        {screen === 'home' && (
          <HomeScreen
            user={currentUser}
            courses={marketplaceCourses}
            leaderboard={leaderboardEntries}
            onNavigate={setScreen}
            onOpenCourse={setDetailCourse}
          />
        )}

        {screen === 'explore' && (
          <ExploreSection
            user={currentUser}
            courses={filteredCourses}
            allCourses={marketplaceCourses}
            categories={Array.from(new Set(marketplaceCourses.map((c) => c.category))).sort()}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            searchQuery={searchQuery}
            onSearch={setSearchQuery}
            onOpenCourse={setDetailCourse}
          />
        )}

        {screen === 'learning' && (
          <LearningScreen
            user={currentUser}
            courses={marketplaceCourses}
            onOpenClassroom={setClassroomCourse}
            onExplore={() => setScreen('explore')}
          />
        )}

        {screen === 'teaching' && (
          <TeachingScreen
            user={currentUser}
            courses={marketplaceCourses}
            requests={enrollmentRequests}
            onDecide={handleTeacherAction}
            onManageCourse={setManagingCourse}
            onPublishCourse={handleStartPublishCourse}
          />
        )}

        {overlays}
      </AppShell>
    );
  }

  // =========================================================================
  // LANDING PAGE (WHEN NOT LOGGED IN YET)
  // =========================================================================
  return <LandingPage onSignUp={() => handleOpenAuth('register')} />;
}
