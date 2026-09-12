package com.ninejatruth.app.presentation.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ninejatruth.app.domain.model.Election
import com.ninejatruth.app.domain.model.NewsArticle
import com.ninejatruth.app.domain.model.Post
import com.ninejatruth.app.domain.usecase.GetFeedsUseCase
import com.ninejatruth.app.domain.usecase.GetNewsUseCase
import com.ninejatruth.app.domain.usecase.GetPartiesUseCase
import com.ninejatruth.app.domain.util.Result
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class HomeUiState(
    val isLoading: Boolean = false,
    val topStories: List<NewsArticle> = emptyList(),
    val upcomingElections: List<Election> = emptyList(),
    val trendingPosts: List<Post> = emptyList(),
    val error: String? = null
)

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val getNewsUseCase: GetNewsUseCase,
    private val getFeedsUseCase: GetFeedsUseCase,
    private val getPartiesUseCase: GetPartiesUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        loadHomeData()
    }

    fun loadHomeData() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)

            // Load news
            launch {
                getNewsUseCase(page = 1).collect { result ->
                    when (result) {
                        is Result.Success -> _uiState.value = _uiState.value.copy(
                            topStories = result.data.take(5),
                            isLoading = false
                        )
                        is Result.Error -> _uiState.value = _uiState.value.copy(
                            error = result.message,
                            isLoading = false
                        )
                        else -> {}
                    }
                }
            }

            // Load trending feeds
            launch {
                getFeedsUseCase(page = 1).collect { result ->
                    when (result) {
                        is Result.Success -> _uiState.value = _uiState.value.copy(
                            trendingPosts = result.data.take(5)
                        )
                        else -> {}
                    }
                }
            }
        }
    }
}
