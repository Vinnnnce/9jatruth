package com.ninejatruth.app.presentation.assistant

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ChatMessage(
    val id: String,
    val content: String,
    val isUser: Boolean,
    val timestamp: Long = System.currentTimeMillis()
)

data class AssistantUiState(
    val messages: List<ChatMessage> = emptyList(),
    val isLoading: Boolean = false,
    val suggestions: List<String> = emptyList()
)

@HiltViewModel
class AssistantViewModel @Inject constructor() : ViewModel() {

    private val _uiState = MutableStateFlow(
        AssistantUiState(
            suggestions = listOf(
                "Who are the candidates in my state?",
                "What promises has my governor made?",
                "When is the next election?",
                "How do I register to vote?"
            )
        )
    )
    val uiState: StateFlow<AssistantUiState> = _uiState.asStateFlow()

    init {
        // Welcome message
        _uiState.value = _uiState.value.copy(
            messages = listOf(
                ChatMessage(
                    id = "welcome",
                    content = "Hello! I'm the 9jaTruth AI Assistant. I can help you with information about Nigerian politics, elections, candidates, parties, and civic duties. What would you like to know?",
                    isUser = false
                )
            )
        )
    }

    fun sendMessage(content: String) {
        val userMessage = ChatMessage(
            id = "user_${System.currentTimeMillis()}",
            content = content,
            isUser = true
        )
        _uiState.value = _uiState.value.copy(
            messages = _uiState.value.messages + userMessage,
            isLoading = true,
            suggestions = emptyList()
        )

        viewModelScope.launch {
            // Simulate AI response (replace with actual API call)
            val response = generateResponse(content)
            val aiMessage = ChatMessage(
                id = "ai_${System.currentTimeMillis()}",
                content = response,
                isUser = false
            )
            _uiState.value = _uiState.value.copy(
                messages = _uiState.value.messages + aiMessage,
                isLoading = false,
                suggestions = _uiState.value.suggestions
            )
        }
    }

    private fun generateResponse(query: String): String {
        return when {
            query.contains("candidate", ignoreCase = true) ->
                "Based on the available data, I can help you find candidates in your state. " +
                "Please navigate to the Politics tab and select Candidates to see a full list. " +
                "You can filter by state, party, or office."

            query.contains("governor", ignoreCase = true) ||
            query.contains("promise", ignoreCase = true) ->
                "I can help you track promises made by elected officials. " +
                "Visit the Politics tab > Candidates to see a candidate's promises and their truth scores. " +
                "Our platform tracks fulfillment rates and provides verified updates."

            query.contains("election", ignoreCase = true) ||
            query.contains("vote", ignoreCase = true) ->
                "The next major election information is available in the Politics tab > Elections. " +
                "You'll find dates, registration deadlines, and turnout data. " +
                "To register to vote, visit the INEC website or your nearest registration center."

            else ->
                "That's a great question! I'm here to help with Nigerian politics and civic engagement. " +
                "You can explore the Politics tab for parties, candidates, and elections, " +
                "the News tab for the latest verified news, or the Feeds tab for community discussions."
        }
    }
}
