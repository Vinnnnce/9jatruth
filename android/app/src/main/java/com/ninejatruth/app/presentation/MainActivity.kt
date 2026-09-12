package com.ninejatruth.app.presentation

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.ninejatruth.app.presentation.auth.AuthViewModel
import com.ninejatruth.app.presentation.navigation.BottomNavItem
import com.ninejatruth.app.presentation.navigation.NavGraph
import com.ninejatruth.app.presentation.navigation.Routes
import com.ninejatruth.app.presentation.theme.NinejaTruthTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            NinejaTruthTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val navController = rememberNavController()
                    val authViewModel: AuthViewModel = hiltViewModel()
                    val authState by authViewModel.uiState.collectAsState()

                    val navBackStackEntry by navController.currentBackStackEntryAsState()
                    val currentRoute = navBackStackEntry?.destination?.route

                    val startDestination = if (authState.isLoggedIn || authState.isGuest) Routes.HOME else Routes.LOGIN

                    val showBottomNav = currentRoute in BottomNavItem.items.map { it.route }

                    // Show a snackbar when auth is required for guest users
                    var showAuthRequiredMessage by remember { mutableStateOf(false) }

                    Scaffold(
                        bottomBar = {
                            if (showBottomNav) {
                                NavigationBar {
                                    BottomNavItem.items.forEach { item ->
                                        NavigationBarItem(
                                            selected = currentRoute == item.route,
                                            onClick = {
                                                navController.navigate(item.route) {
                                                    popUpTo(navController.graph.startDestinationId) {
                                                        saveState = true
                                                    }
                                                    launchSingleTop = true
                                                    restoreState = true
                                                }
                                            },
                                            icon = {
                                                Icon(
                                                    imageVector = if (currentRoute == item.route)
                                                        item.selectedIcon else item.unselectedIcon,
                                                    contentDescription = item.title
                                                )
                                            },
                                            label = {
                                                Text(text = item.title)
                                            }
                                        )
                                    }
                                }
                            }
                        }
                    ) { _ ->
                        NavGraph(
                            navController = navController,
                            startDestination = startDestination,
                            onAuthRequired = {
                                if (authState.isGuest) {
                                    showAuthRequiredMessage = true
                                }
                            }
                        )
                    }

                    if (showAuthRequiredMessage) {
                        Snackbar(
                            modifier = Modifier.padding(16.dp),
                            action = {
                                TextButton(onClick = {
                                    showAuthRequiredMessage = false
                                    navController.navigate(Routes.LOGIN)
                                }) {
                                    Text("Sign In")
                                }
                            },
                            dismissAction = {
                                TextButton(onClick = { showAuthRequiredMessage = false }) {
                                    Text("Dismiss")
                                }
                            }
                        ) {
                            Text("Please sign in to access this feature")
                        }
                    }
                }
            }
        }
    }
}
