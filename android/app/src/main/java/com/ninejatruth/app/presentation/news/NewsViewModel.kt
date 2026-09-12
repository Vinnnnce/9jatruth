package com.ninejatruth.app.presentation.news

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ninejatruth.app.domain.model.NewsArticle
import com.ninejatruth.app.domain.usecase.GetNewsUseCase
import com.ninejatruth.app.domain.util.Result
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class NewsUiState(
    val isLoading: Boolean = false,
    val articles: List<NewsArticle> = emptyList(),
    val selectedCategory: String? = null,
    val error: String? = null
)

@HiltViewModel
class NewsViewModel @Inject constructor(
    private val getNewsUseCase: GetNewsUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(NewsUiState())
    val uiState: StateFlow<NewsUiState> = _uiState.asStateFlow()

    val categories = listOf("Politics", "Governance", "Elections", "Fact Check")

    init {
        loadNews()
    }

    fun loadNews() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            getNewsUseCase(page = 1, category = _uiState.value.selectedCategory).collect { result ->
                when (result) {
                    is Result.Loading -> _uiState.value = _uiState.value.copy(isLoading = true)
                    is Result.Success -> _uiState.value = NewsUiState(
                        articles = result.data,
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
        loadNews()
    }
}
