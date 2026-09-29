
            const result = await response.json();

            if (!result?.success) {
                console.warn('Admin MarkChatRead rejected:', result?.message);
                return false;
            }

            if (item) {
                setChatUnread(item, 0);
            }

            const sidebarDot =
                document.getElementById('adminChatSidebarDot');

            const hasOtherUnreadChats =
                Array.from(
                    document.querySelectorAll('.admin-chat-item')
                ).some(chatItem =>
                    (parseInt(chatItem.dataset.unread || '0', 10) || 0) > 0
                );

            if (sidebarDot) {
                sidebarDot.hidden = !hasOtherUnreadChats;
            }

            return true;
        }
        catch (error) {
            console.warn('Admin MarkChatRead failed:', error);
            return false;
        }
    }


    /* =========================================================
       DELETE CHAT
       Deletes only the chat session and its messages.
       Task, project, assignment and notification remain intact.
    ========================================================= */