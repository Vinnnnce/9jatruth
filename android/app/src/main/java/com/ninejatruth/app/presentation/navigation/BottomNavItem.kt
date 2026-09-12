package com.ninejatruth.app.presentation.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.ui.graphics.vector.ImageVector

sealed class BottomNavItem(
    val route: String,
    val title: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector
) {
    data object Home : BottomNavItem(
        route = Routes.HOME,
        title = "Home",
        selectedIcon = Icons.Filled.Home,
        unselectedIcon = Icons.Outlined.Home
    )

    data object Politics : BottomNavItem(
        route = Routes.POLITICS,
        title = "Politics",
        selectedIcon = Icons.Filled.AccountBalance,
        unselectedIcon = Icons.Outlined.AccountBalance
    )

    data object Feeds : BottomNavItem(
        route = Routes.FEEDS,
        title = "Feeds",
        selectedIcon = Icons.Filled.Forum,
        unselectedIcon = Icons.Outlined.Forum
    )

    data object News : BottomNavItem(
        route = Routes.NEWS,
        title = "News",
        selectedIcon = Icons.Filled.Article,
        unselectedIcon = Icons.Outlined.Article
    )

    data object Profile : BottomNavItem(
        route = Routes.PROFILE,
        title = "Profile",
        selectedIcon = Icons.Filled.Person,
        unselectedIcon = Icons.Outlined.Person
    )

    companion object {
        val items = listOf(Home, Politics, Feeds, News, Profile)
    }
}
