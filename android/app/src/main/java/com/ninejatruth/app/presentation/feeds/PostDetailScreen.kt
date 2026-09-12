package com.ninejatruth.app.presentation.feeds

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
import com.ninejatruth.app.domain.model.Comment
import com.ninejatruth.app.domain.model.Post
import com.ninejatruth.app.domain.repository.FeedRepository
import com.ninejatruth.app.domain.util.Result
import com.ninejatruth.app.presentation.components.*
import com.ninejatruth.app.presentation.theme.NigeriaGreen
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PostDetailUiState(
    val isLoading: Boolean = false,
    val post: Post? = null,
    val comments: List<Comment> = emptyList(),
    val error: String? = null
)

@HiltViewModel
class PostDetailViewModel @Inject constructor(
    private val feedRepository: FeedRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(PostDetailUiState())
    val uiState: StateFlow<PostDetailUiState> = _uiState.asStateFlow()

    fun loadPost(postId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            feedRepository.getPost(postId).collect { result ->
                when (result) {
                    is Result.Loading -> _uiState.value = _uiState.value.copy(isLoading = true)
                    is Result.Success -> _uiState.value = _uiState.value.copy(
                        post = result.data,
                        isLoading = false
                    )
                    is Result.Error -> _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.message
                    )
                }
            }
        }
    }

    fun addComment(postId: String, content: String) {
        viewModelScope.launch {
            feedRepository.createComment(postId, content).collect { result ->
                if (result is Result.Success) {
                    _uiState.value = _uiState.value.copy(
                        comments = _uiState.value.comments + result.data
                    )
                }
            }
        }
    }
}

@Composable
fun PostDetailScreen(
    postId: String,
    onBack: () -> Unit,
    viewModel: PostDetailViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var commentText by remember { mutableStateOf("") }

    LaunchedEffect(postId) {
        viewModel.loadPost(postId)
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
                onRetry = { viewModel.loadPost(postId) },
                modifier = Modifier.padding(padding)
            )
            return@Scaffold
        }

        val post = uiState.post ?: return@Scaffold

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Full post content
            Text(
                text = post.title,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "By ${post.authorName}",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                TruthScoreBadge(score = post.truthScore)
            }

            Text(
                text = post.content,
                style = MaterialTheme.typography.bodyMedium
            )

            // Tags
            if (post.tags.isNotEmpty()) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    post.tags.forEach { tag ->
                        SuggestionChip(
                            onClick = {},
                            label = { Text("#$tag", style = MaterialTheme.typography.labelSmall) }
                        )
                    }
                }
            }

            Divider()

            // Comments section
            Text(
                text = "Comments (${post.commentCount})",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            // Comment input
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = commentText,
                    onValueChange = { commentText = it },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("Add a comment...") },
                    shape = MaterialTheme.shapes.small
                )
                Button(
                    onClick = {
                        if (commentText.isNotBlank()) {
                            viewModel.addComment(postId, commentText)
                            commentText = ""
                        }
                    },
                    enabled = commentText.isNotBlank()
                ) {
                    Text("Post")
                }
            }

            // Comments list
            uiState.comments.forEach { comment ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = MaterialTheme.shapes.medium,
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp)
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(
                            text = comment.authorName,
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = comment.content,
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }
            }
        }
    }
}
