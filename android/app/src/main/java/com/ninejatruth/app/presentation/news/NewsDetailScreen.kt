package com.ninejatruth.app.presentation.news

import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.hilt.navigation.compose.hiltViewModel
import com.google.accompanist.web.WebView
import com.google.accompanist.web.rememberWebViewState
import com.ninejatruth.app.domain.model.NewsArticle
import com.ninejatruth.app.domain.repository.NewsRepository
import com.ninejatruth.app.domain.util.Result
import com.ninejatruth.app.presentation.components.ErrorView
import com.ninejatruth.app.presentation.components.LoadingIndicator
import com.ninejatruth.app.presentation.components.TruthScoreBadge
import com.ninejatruth.app.presentation.theme.NigeriaGreen
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class NewsDetailUiState(
    val isLoading: Boolean = false,
    val article: NewsArticle? = null,
    val error: String? = null
)

@HiltViewModel
class NewsDetailViewModel @Inject constructor(
    private val newsRepository: NewsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(NewsDetailUiState())
    val uiState: StateFlow<NewsDetailUiState> = _uiState.asStateFlow()

    fun loadArticle(articleId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            newsRepository.getNewsArticle(articleId).collect { result ->
                when (result) {
                    is Result.Loading -> _uiState.value = _uiState.value.copy(isLoading = true)
                    is Result.Success -> _uiState.value = NewsDetailUiState(article = result.data)
                    is Result.Error -> _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.message
                    )
                }
            }
        }
    }
}

@Composable
fun NewsDetailScreen(
    articleId: String,
    onBack: () -> Unit,
    viewModel: NewsDetailViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(articleId) {
        viewModel.loadArticle(articleId)
    }

    Scaffold(
        topBar = {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(onClick = onBack) {
                    Text("Back", color = NigeriaGreen)
                }
            }
        }
    ) { padding ->
        if (uiState.isLoading) {
            LoadingIndicator(modifier = Modifier.padding(padding))
            return@Scaffold
        }

        if (uiState.error != null) {
            ErrorView(
                message = uiState.error!!,
                onRetry = { viewModel.loadArticle(articleId) },
                modifier = Modifier.padding(padding)
            )
            return@Scaffold
        }

        val article = uiState.article ?: return@Scaffold

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Article header
            Column(modifier = Modifier.padding(20.dp)) {
                Text(
                    text = article.title,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "${article.source} - ${article.author ?: ""}",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    TruthScoreBadge(score = article.truthScore)
                }
            }

            // WebView for full article
            val webViewState = rememberWebViewState(article.sourceUrl)
            WebView(
                state = webViewState,
                modifier = Modifier.fillMaxSize(),
                onCreated = { webView ->
                    webView.settings.apply {
                        javaScriptEnabled = true
                        domStorageEnabled = true
                    }
                    webView.webViewClient = WebViewClient()
                }
            )
        }
    }
}
