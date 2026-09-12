package com.ninejatruth.app.presentation.home

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.ninejatruth.app.presentation.components.*
import com.ninejatruth.app.presentation.theme.NigeriaGreen

@Composable
fun HomeScreen(
    onNavigateToPolitics: () -> Unit,
    onNavigateToNews: () -> Unit,
    onNavigateToFeeds: () -> Unit,
    onNavigateToAssistant: () -> Unit,
    onNavigateToElection: (String) -> Unit,
    onNavigateToPost: (String) -> Unit,
    onNavigateToNewsDetail: (String) -> Unit,
    viewModel: HomeViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(
                        text = "9jaTruth",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        color = NigeriaGreen
                    )
                    Text(
                        text = "Truth. Accountability. Nigeria.",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    ) { paddingValues ->
        if (uiState.isLoading) {
            LoadingIndicator(modifier = Modifier.padding(paddingValues))
            return@Scaffold
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            Spacer(modifier = Modifier.height(4.dp))

            // Hero Card
            HeroCard(
                title = "Know Your Leaders.\nHold Them Accountable.",
                subtitle = "Track promises. Verify facts. Vote wisely."
            )

            // Quick Actions
            QuickActionBar(
                actions = listOf(
                    QuickAction(
                        icon = androidx.compose.material.icons.Icons.Filled.AccountBalance,
                        label = "Politics",
                        onClick = onNavigateToPolitics
                    ),
                    QuickAction(
                        icon = androidx.compose.material.icons.Icons.Filled.Article,
                        label = "News",
                        onClick = onNavigateToNews
                    ),
                    QuickAction(
                        icon = androidx.compose.material.icons.Icons.Filled.HowToVote,
                        label = "Polls",
                        onClick = onNavigateToFeeds
                    ),
                    QuickAction(
                        icon = androidx.compose.material.icons.Icons.Filled.Forum,
                        label = "Feed",
                        onClick = onNavigateToFeeds
                    )
                )
            )

            // AI Assistant Entry
            AssistantEntry(onClick = onNavigateToAssistant)

            // Top Stories
            if (uiState.topStories.isNotEmpty()) {
                SectionHeader(title = "Top Stories")
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    uiState.topStories.forEach { article ->
                        NewsCard(
                            article = article,
                            onClick = { onNavigateToNewsDetail(article.id) }
                        )
                    }
                }
            }

            // Trending Posts
            if (uiState.trendingPosts.isNotEmpty()) {
                SectionHeader(title = "Trending Topics")
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    uiState.trendingPosts.forEach { post ->
                        PostCard(
                            post = post,
                            onClick = { onNavigateToPost(post.id) }
                        )
                    }
                }
            }

            // Error
            if (uiState.error != null && uiState.topStories.isEmpty()) {
                ErrorView(
                    message = uiState.error!!,
                    onRetry = { viewModel.loadHomeData() }
                )
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun SectionHeader(title: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = "See All",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.primary,
            fontWeight = FontWeight.SemiBold
        )
    }
}
