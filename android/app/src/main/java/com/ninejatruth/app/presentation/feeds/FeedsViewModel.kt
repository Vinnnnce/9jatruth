package com.ninejatruth.app.presentation.feeds

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ninejatruth.app.domain.model.Post
import com.ninejatruth.app.domain.usecase.CreatePostUseCase
import com.ninejatruth.app.domain.usecase.GetFeedsUseCase
import com.ninejatruth.app.domain.util.Result
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class FeedsUiState(
    val isLoading: Boolean = false,
    val posts: List<Post> = emptyList(),
    val selectedCategory: String? = null,
    val error: String? = null
)

@HiltViewModel
class FeedsViewModel @Inject constructor(
    private val getFeedsUseCase: GetFeedsUseCase,
    private val createPostUseCase: CreatePostUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(FeedsUiState())
    val uiState: StateFlow<FeedsUiState> = _uiState.asStateFlow()

    private val _createPostState = MutableStateFlow<Result<Post>?>(null)
    val createPostState: StateFlow<Result<Post>?> = _createPostState.asStateFlow()

    val categories = listOf("Politics", "Governance", "Elections", "Community", "Fact Check")

    init {
        loadFeeds()
    }

    fun loadFeeds() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            getFeedsUseCase(page = 1, category = _uiState.value.selectedCategory).collect { result ->
                when (result) {
                    is Result.Loading -> _uiState.value = _uiState.value.copy(isLoading = true)
                    is Result.Success -> _uiState.value = FeedsUiState(
                        posts = result.data,
                        selectedCategory = _uiState.value.selectedCategory
                    )
                    is Result.Error -> _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.message
                    )
                }
            }
        }
    }

    fun selectCategory(category: String?) {
        _uiState.value = _uiState.value.copy(selectedCategory = category)
        loadFeeds()
    }

    fun createPost(title: String, content: String, tags: List<String>) {
        viewModelScope.launch {
            createPostUseCase(title, content, null, null, tags).collect { result ->
                _createPostState.value = result
            }
        }
    }

    fun resetCreatePostState() {
        _createPostState.value = null
    }
}
