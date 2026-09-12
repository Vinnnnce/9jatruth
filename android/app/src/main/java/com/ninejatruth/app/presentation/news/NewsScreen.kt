package com.ninejatruth.app.presentation.news

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.ninejatruth.app.presentation.components.*

@Composable
fun NewsScreen(
    onNavigateToNewsDetail: (String) -> Unit,
    viewModel: NewsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "News",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Category chips
            CategoryChips(
                categories = viewModel.categories,
                selectedCategory = uiState.selectedCategory,
                onCategorySelected = { viewModel.selectCategory(it) },
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
            )

            if (uiState.isLoading) {
                LoadingIndicator()
            } else if (uiState.error != null && uiState.articles.isEmpty()) {
                ErrorView(
                    message = uiState.error!!,
                    onRetry = { viewModel.loadNews() }
                )
            } else if (uiState.articles.isEmpty()) {
                EmptyStateView(
                    title = "No news yet",
                    subtitle = "News articles will appear here"
                )
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(20.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(uiState.articles) { article ->
                        NewsCard(
                            article = article,
                            onClick = { onNavigateToNewsDetail(article.id) }
                        )
                    }
                }
            }
        }
    }
}
