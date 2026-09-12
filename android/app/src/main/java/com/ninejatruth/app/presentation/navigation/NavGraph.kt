package com.ninejatruth.app.presentation.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.ninejatruth.app.presentation.assistant.AssistantScreen
import com.ninejatruth.app.presentation.auth.AuthViewModel
import com.ninejatruth.app.presentation.auth.LoginScreen
import com.ninejatruth.app.presentation.auth.OnboardingScreen
import com.ninejatruth.app.presentation.auth.RegisterScreen
import com.ninejatruth.app.presentation.feeds.CreatePostScreen
import com.ninejatruth.app.presentation.feeds.FeedsScreen
import com.ninejatruth.app.presentation.feeds.PostDetailScreen
import com.ninejatruth.app.presentation.home.HomeScreen
import com.ninejatruth.app.presentation.news.NewsDetailScreen
import com.ninejatruth.app.presentation.news.NewsScreen
import com.ninejatruth.app.presentation.politics.CandidateDetailScreen
import com.ninejatruth.app.presentation.politics.ElectionDetailScreen
import com.ninejatruth.app.presentation.politics.PartyDetailScreen
import com.ninejatruth.app.presentation.politics.PoliticsScreen
import com.ninejatruth.app.presentation.profile.ProfileScreen
import com.ninejatruth.app.presentation.profile.SettingsScreen

@Composable
fun NavGraph(
    navController: NavHostController,
    startDestination: String,
    onAuthRequired: () -> Unit = {}
) {
    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        composable(Routes.LOGIN) {
            LoginScreen(
                onLoginSuccess = {
                    navController.navigate(Routes.HOME) {
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                },
                onNavigateToRegister = {
                    navController.navigate(Routes.REGISTER)
                },
                onContinueAsGuest = {
                    navController.navigate(Routes.HOME) {
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.REGISTER) {
            RegisterScreen(
                onRegisterSuccess = {
                    navController.navigate(Routes.HOME) {
                        popUpTo(Routes.REGISTER) { inclusive = true }
                    }
                },
                onNavigateToLogin = {
                    navController.popBackStack()
                }
            )
        }

        composable(Routes.ONBOARDING) {
            OnboardingScreen(
                onContinue = {
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(Routes.ONBOARDING) { inclusive = true }
                    }
                },
                onSkip = {
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(Routes.ONBOARDING) { inclusive = true }
                    }
                },
                onContinueAsGuest = {
                    navController.navigate(Routes.HOME) {
                        popUpTo(Routes.ONBOARDING) { inclusive = true }
                    }
                }
            )
        }

        // Main tab screens
        composable(Routes.HOME) {
            HomeScreen(
                onNavigateToPolitics = { navController.navigate(Routes.POLITICS) },
                onNavigateToNews = { navController.navigate(Routes.NEWS) },
                onNavigateToFeeds = { navController.navigate(Routes.FEEDS) },
                onNavigateToAssistant = { navController.navigate(Routes.ASSISTANT) },
                onNavigateToElection = { navController.navigate(Routes.electionDetail(it)) },
                onNavigateToPost = { navController.navigate(Routes.postDetail(it)) },
                onNavigateToNewsDetail = { navController.navigate(Routes.newsDetail(it)) }
            )
        }

        composable(Routes.POLITICS) {
            PoliticsScreen(
                onNavigateToParty = { navController.navigate(Routes.partyDetail(it)) },
                onNavigateToCandidate = { navController.navigate(Routes.candidateDetail(it)) },
                onNavigateToElection = { navController.navigate(Routes.electionDetail(it)) }
            )
        }

        composable(Routes.FEEDS) {
            FeedsScreen(
                onNavigateToPost = { navController.navigate(Routes.postDetail(it)) },
                onNavigateToCreatePost = {
                    onAuthRequired()
                    navController.navigate(Routes.CREATE_POST)
                }
            )
        }

        composable(Routes.NEWS) {
            NewsScreen(
                onNavigateToNewsDetail = {
                    onAuthRequired()
                    navController.navigate(Routes.newsDetail(it))
                }
            )
        }

        composable(Routes.PROFILE) {
            ProfileScreen(
                onNavigateToSettings = { navController.navigate(Routes.SETTINGS) },
                onNavigateToAssistant = { navController.navigate(Routes.ASSISTANT) },
                onNavigateToLogin = {
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(0) { inclusive = true }
                    }
                },
                onLogout = {
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }

        // Detail screens
        composable(
            route = Routes.PARTY_DETAIL,
            arguments = listOf(navArgument("partyId") { type = NavType.StringType })
        ) { backStackEntry ->
            val partyId = backStackEntry.arguments?.getString("partyId") ?: return@composable
            PartyDetailScreen(
                partyId = partyId,
                onBack = { navController.popBackStack() }
            )
        }

        composable(
            route = Routes.CANDIDATE_DETAIL,
            arguments = listOf(navArgument("candidateId") { type = NavType.StringType })
        ) { backStackEntry ->
            val candidateId = backStackEntry.arguments?.getString("candidateId") ?: return@composable
            CandidateDetailScreen(
                candidateId = candidateId,
                onBack = { navController.popBackStack() }
            )
        }

        composable(
            route = Routes.ELECTION_DETAIL,
            arguments = listOf(navArgument("electionId") { type = NavType.StringType })
        ) { backStackEntry ->
            val electionId = backStackEntry.arguments?.getString("electionId") ?: return@composable
            ElectionDetailScreen(
                electionId = electionId,
                onBack = { navController.popBackStack() }
            )
        }

        composable(
            route = Routes.POST_DETAIL,
            arguments = listOf(navArgument("postId") { type = NavType.StringType })
        ) { backStackEntry ->
            val postId = backStackEntry.arguments?.getString("postId") ?: return@composable
            PostDetailScreen(
                postId = postId,
                onBack = { navController.popBackStack() }
            )
        }

        composable(Routes.CREATE_POST) {
            CreatePostScreen(
                onBack = { navController.popBackStack() },
                onPostCreated = { navController.popBackStack() }
            )
        }

        composable(
            route = Routes.NEWS_DETAIL,
            arguments = listOf(navArgument("articleId") { type = NavType.StringType })
        ) { backStackEntry ->
            val articleId = backStackEntry.arguments?.getString("articleId") ?: return@composable
            NewsDetailScreen(
                articleId = articleId,
                onBack = { navController.popBackStack() }
            )
        }

        composable(Routes.SETTINGS) {
            SettingsScreen(
                onBack = { navController.popBackStack() },
                onLogout = {
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.ASSISTANT) {
            AssistantScreen(
                onBack = { navController.popBackStack() }
            )
        }
    }
}
