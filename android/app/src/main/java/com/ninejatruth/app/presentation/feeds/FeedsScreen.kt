package com.ninejatruth.app.presentation.feeds

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.ninejatruth.app.presentation.components.*

@Composable
fun FeedsScreen(
    onNavigateToPost: (String) -> Unit,
    onNavigateToCreatePost: () -> Unit,
    viewModel: FeedsViewModel = hiltViewModel()
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
                Text(
                    text = "Community Feed",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold
                )
            }
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = onNavigateToCreatePost,
                containerColor = MaterialTheme.colorScheme.primary
            ) {
                Icon(Icons.Filled.Add, contentDescription = "Create Post")
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Filter chips
            CategoryChips(
                categories = viewModel.categories,
                selectedCategory = uiState.selectedCategory,
                onCategorySelected = { viewModel.selectCategory(it) },
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
            )

            if (uiState.isLoading) {
                LoadingIndicator()
            } else if (uiState.error != null && uiState.posts.isEmpty()) {
                ErrorView(
                    message = uiState.error!!,
                    onRetry = { viewModel.loadFeeds() }
                )
            } else if (uiState.posts.isEmpty()) {
                EmptyStateView(
                    title = "No posts yet",
                    subtitle = "Be the first to share something"
                )
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(20.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(uiState.posts) { post ->
                        PostCard(
                            post = post,
                            onClick = { onNavigateToPost(post.id) }
                        )
                    }
                }
            }
        }
    }
}
